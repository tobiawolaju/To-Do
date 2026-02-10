require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { VertexAI } = require('@google-cloud/vertexai');
const crypto = require('crypto');
const tools = require('./tools');

// --------------------
// Vertex AI Configuration
// --------------------
const path = require('path');
const fs = require('fs');

const projectId = process.env.VERTEX_AI_PROJECT_ID;
const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

// Match service account path logic from firebase-config.js
const serviceAccountPath = process.env.RENDER
    ? '/etc/secrets/serviceAccountKey.json'
    : path.join(__dirname, 'serviceAccountKey.json');

// If we have a local service account file, set it for the Cloud SDKs to find
if (fs.existsSync(serviceAccountPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
}

const vertexAI = new VertexAI({ project: projectId, location: location });

// Using gemini-1.5-flash model via Vertex AI for better regional support
const model = 'gemini-1.5-flash-002';

// Helper function to generate content using Vertex AI
async function generateContent(prompt) {
    const generativeModel = vertexAI.getGenerativeModel({ model: model });
    const result = await generativeModel.generateContent(prompt);
    return result;
}

// --------------------
// Express App
// --------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// Activity Management Routes (Direct)
// --------------------
app.post("/api/activities/update", async (req, res) => {
    const { id, updates, userId, accessToken, timeZone } = req.body;
    try {
        const result = await tools.updateActivity({ id, ...updates }, { uid: userId, accessToken, timeZone });
        res.json(result);
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/activities/delete", async (req, res) => {
    const { id, userId, accessToken, timeZone } = req.body;
    try {
        const result = await tools.deleteActivity({ id }, { uid: userId, accessToken, timeZone });
        res.json(result);
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --------------------
// Helpers
// --------------------
function normalizeAliases(args) {
    return {
        title: args.title || args.activity || args.task || args.event,
        startTime: args.startTime || args.time || args.at || args.start,
        endTime: args.endTime || args.end,
        duration: args.duration,
        description: args.description || args.desc,
        location: args.location,
        id: args.id,
        query: args.query,
        tags: args.tags,
        days: args.days || args.recurrence || args.on
    };
}

function parseTime(timeStr) {
    const match = timeStr?.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || "0", 10);
    const meridian = match[3]?.toLowerCase();

    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    const date = new Date();
    date.setHours(hour, minutes, 0, 0);
    return date;
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5); // HH:MM
}

function normalizeAddActivityArgs(args) {
    const { title, startTime, endTime, duration } = args;

    if (!title || !startTime) {
        throw new Error(`Missing title or startTime for task: ${title || 'Unknown'}`);
    }

    // Ensure startTime is formatted as HH:MM
    const parsedStart = parseTime(startTime);
    let normalizedStartTime = startTime;
    if (parsedStart) {
        normalizedStartTime = formatTime(parsedStart);
    }

    let finalEndTime = endTime;

    if (!endTime && duration) {
        const match = duration.match(/(\d+)\s*(min|mins|minutes|hr|hour|hours)/i);
        if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            const start = parseTime(startTime);
            if (start) {
                const minutesToAdd = unit.startsWith("h") ? value * 60 : value;
                const end = new Date(start.getTime() + minutesToAdd * 60000);
                finalEndTime = formatTime(end);
            }
        }
    }

    // Ensure endTime is formatted as HH:MM if it was provided directly
    if (endTime && !finalEndTime) {
        const parsedEnd = parseTime(endTime);
        if (parsedEnd) {
            finalEndTime = formatTime(parsedEnd);
        }
    }

    // Default to 1 hour if no end time/duration provided
    if (!finalEndTime && parsedStart) {
        const end = new Date(parsedStart.getTime() + 60 * 60000);
        finalEndTime = formatTime(end);
    }

    if (!finalEndTime) {
        // Fallback for edge cases
        throw new Error(`Could not calculate end time for ${title}`);
    }

    return {
        ...args,
        startTime: normalizedStartTime,
        endTime: finalEndTime
    };
}

// --------------------
// Intent Extraction
// --------------------
async function extractIntent(message) {
    const prompt = `
You are an intent extraction engine.

Return ONLY valid JSON.
No markdown. No commentary.

IMPORTANT:
- Use ONLY the field names defined below
- DO NOT invent new field names
- Map user language to these exact keys

Schema:
{
  "intent": "getSchedule" | "addActivity" | "updateActivity" | "deleteActivity" | "findHackathons" | null,
  "arguments": { ... } OR [ { ... }, { ... } ],
  "confidence": number
}

Mapping rules:
- "activity", "task", "event" → title
- "time", "at", "starts" → startTime
- "for X minutes/hours" → duration
- "with tags X, Y" or "tagged as X" → tags (array of strings)
- "on Mondays", "every Tuesday", "weekdays", "daily" → days (array of strings, e.g., ["Monday", "Tuesday"])

MULTIPLE TASKS:
If the user wants to add multiple activities (e.g., "Swim at 10pm AND Read at 8am"),
set "intent" to "addActivity" and make "arguments" an ARRAY of objects.

User message:
"${message}"
`;

    try {
        const result = await generateContent(prompt);
        const text = result.response.candidates[0].content.parts[0].text.trim();
        const jsonText = text.replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(jsonText);
    } catch (err) {
        // Handle 429 Quota Exceeded
        if (err.status === 429 || err.message?.includes("429")) {
            console.error("Vertex AI Quota Exceeded:", err.message);
            return { intent: "quotaError", arguments: {}, confidence: 1 };
        }
        console.error("Intent extraction failed:", err);
        return { intent: null, arguments: {}, confidence: 0 };
    }
}


// --------------------
// Chat API
// --------------------
app.post("/api/chat", async (req, res) => {
    try {
        const { message, userId, accessToken, timeZone } = req.body;
        if (!message || !userId) {
            return res.status(400).json({ error: "message and userId required" });
        }

        const { intent, arguments: rawArgs, confidence } = await extractIntent(message);
        console.log("INTENT:", intent, "ARGS:", JSON.stringify(rawArgs, null, 2), "TZ:", timeZone);

        if (intent === "quotaError") {
            return res.json({
                reply: "I’m getting tons of requests right now! Please try again in a minute. ⏳",
                refreshNeeded: false
            });
        }

        if (!intent || confidence < 0.6) {
            return res.json({ reply: "I’m not sure what you want to do.", refreshNeeded: false });
        }

        let result = null;
        let refreshNeeded = false;
        let reply = "Done ✅";
        const context = { uid: userId, accessToken, timeZone };

        switch (intent) {
            case "addActivity": {
                const argsList = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
                const responses = [];
                for (const args of argsList) {
                    try {
                        const aliasedArgs = normalizeAliases(args);
                        const safeArgs = normalizeAddActivityArgs(aliasedArgs);
                        const opResult = await tools.addActivity(safeArgs, context);
                        responses.push(opResult);
                    } catch (innerErr) {
                        console.error(`Error adding task:`, innerErr);
                        responses.push({ success: false, error: innerErr.message });
                    }
                }
                const successCount = responses.filter(r => r.success).length;
                const failCount = responses.length - successCount;

                if (successCount > 0 && failCount === 0) {
                    reply = responses.length > 1 ? "Done! I've added all your tasks." : "Done! Added the activity.";
                } else if (successCount > 0 && failCount > 0) {
                    reply = `Partially successful. Added ${successCount} tasks, but ${failCount} failed.`;
                } else {
                    reply = `I couldn't add that. Error: ${responses[0]?.error || "Unknown error"}`;
                }

                result = { message: `Processed ${responses.length} requests.`, details: responses };
                refreshNeeded = successCount > 0;
                break;
            }

            case "updateActivity": {
                const aliasedArgs = normalizeAliases(rawArgs);
                result = await tools.updateActivity(aliasedArgs, context);
                reply = result.success ? "Updated! ✅" : `Failed to update: ${result.message || result.error}`;
                refreshNeeded = !!result.success;
                break;
            }

            case "deleteActivity": {
                const aliasedArgs = normalizeAliases(rawArgs);
                result = await tools.deleteActivity(aliasedArgs, context);
                reply = result.success ? "Deleted! 🗑️" : `Failed to delete: ${result.message || result.error}`;
                refreshNeeded = !!result.success;
                break;
            }

            case "getSchedule": {
                result = await tools.getSchedule({}, context);
                break;
            }

            case "findHackathons": {
                result = await tools.findHackathons({ query: rawArgs.query || "hackathons" });
                break;
            }

            default:
                reply = "That action isn’t supported yet.";
                break;
        }

        if (!res.headersSent) {
            res.json({ reply, result, refreshNeeded });
        }

    } catch (err) {
        console.error("Chat error:", err);
        if (!res.headersSent) {
            res.status(500).json({ reply: "An error occurred: " + err.message, refreshNeeded: false });
        }
    }
});

// --------------------
// Prediction API
// --------------------
app.post("/api/predict-future", async (req, res) => {
    try {
        const { userId, accessToken, timeZone } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }



        // 1. Check for existing futures (will verify staleness later)
        const existingFutures = await tools.getUserFutures(userId);

        // 2. Gather context (Schedule + Chat History)
        const context = { uid: userId, accessToken, timeZone };
        const { messages: chatHistory, schedule } = await tools.getConversationHistory(userId);

        if ((!schedule || schedule.length === 0) && chatHistory.length === 0) {
            return res.json({
                futures: [],
                message: "Not enough data! Add some activities or chat with me so I can predict your future."
            });
        }

        // 3. Compute Content Hash for Staleness Check
        // Sort schedule by ID to ensure consistent ordering
        const sortedSchedule = [...schedule].sort((a, b) => (a.id || 0) - (b.id || 0));

        // Create deterministic string representation
        const contentToHash = JSON.stringify({
            schedule: sortedSchedule.map(a => ({
                id: a.id, title: a.title, days: a.days, startTime: a.startTime, endTime: a.endTime
            })),
            chat: chatHistory.map(m => ({ role: m.role, content: m.content }))
        });

        const currentHash = crypto.createHash('sha256').update(contentToHash).digest('hex');
        const storedHash = existingFutures?.hash;

        console.log(`Futures Hash Check [${userId}]: Current=${currentHash.substring(0, 8)} Stored=${storedHash ? storedHash.substring(0, 8) : 'None'}`);

        if (storedHash === currentHash && existingFutures && existingFutures.data) {
            console.log(`Returning cached futures (Hash Match)`);
            return res.json({ futures: existingFutures.data });
        }

        console.log(`Regenerating futures (Hash Mismatch)`);

        // 3. Construct Prompt
        const scheduleText = JSON.stringify(schedule.map(a => ({ title: a.title, days: a.days, startTime: a.startTime, endTime: a.endTime })));
        const chatText = chatHistory.map(m => `${m.role}: ${m.content}`).join("\n");

        const prompt = `
            You are a prescient life simulator engine.
            Analyze the user's data to project 3 distinct future paths.

            DATA:
            - Schedule: ${scheduleText}
            - Recent Chat Context: ${chatText}

            TASK:
            Generate 3 future scenarios based on their current trajectory, habits, and mindset.
            1. "Baseline Path": The most likely outcome if they keep doing exactly what they are doing.
            2. "Optimistic Path": The outcome if they successfully implement their goals and optimize their routine.
            3. "Risk Path": The outcome if bad habits compound or burnout ensues.

            OUTPUT FORMAT:
            Return ONLY a JSON array of 3 objects. No markdown.
            [
              {
                "title": "Baseline Path", 
                "timeHorizon": "6 months", 
                "summary": ["Bullet 1", "Bullet 2"], 
                "details": "Full narrative explanation..." 
              },
              ...
            ]

            Tone: Serious, analytical, slightly dramatic but realistic.
        `;

        // 4. Call Vertex AI
        try {
            const result = await generateContent(prompt);
            const text = result.response.candidates[0].content.parts[0].text.trim();
            const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const futures = JSON.parse(jsonText);

            // 5. Store in Firebase with Hash
            await tools.saveUserFutures(userId, futures, currentHash);

            res.json({ futures });

        } catch (err) {
            if (err.status === 429 || err.message?.includes("429")) {
                return res.status(429).json({ error: "Too many predictions right now. Try again later." });
            }
            console.error("Vertex AI Generation Error:", err);
            throw err;
        }

    } catch (err) {
        console.error("Prediction error:", err);
        res.status(500).json({ error: "Failed to generate prediction: " + err.message });
    }
});

// --------------------
// Futures Staleness Check API
// --------------------
app.post("/api/check-futures-status", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        // Get existing futures
        const existingFutures = await tools.getUserFutures(userId);

        // Gather context
        const { messages: chatHistory, schedule } = await tools.getConversationHistory(userId);

        // If no data, not stale (nothing to predict from)
        if ((!schedule || schedule.length === 0) && chatHistory.length === 0) {
            return res.json({ isStale: false, hasFutures: false });
        }

        // Compute current hash
        const sortedSchedule = [...schedule].sort((a, b) => (a.id || 0) - (b.id || 0));
        const contentToHash = JSON.stringify({
            schedule: sortedSchedule.map(a => ({
                id: a.id, title: a.title, days: a.days, startTime: a.startTime, endTime: a.endTime
            })),
            chat: chatHistory.map(m => ({ role: m.role, content: m.content }))
        });

        const currentHash = crypto.createHash('sha256').update(contentToHash).digest('hex');
        const storedHash = existingFutures?.hash;

        const hasFutures = !!(existingFutures && existingFutures.data);
        const isStale = hasFutures && storedHash !== currentHash;

        res.json({ isStale, hasFutures, currentHash: currentHash.substring(0, 8), storedHash: storedHash?.substring(0, 8) });

    } catch (err) {
        console.error("Futures status check error:", err);
        res.status(500).json({ error: "Failed to check futures status: " + err.message });
    }
});

// --------------------
// Conversational Chat API
// --------------------
const LIFE_PLANNER_PROMPT = `You are a life planning assistant for IF·THEN - a personal consequence simulator.

Your role is to help users transform their goals and dreams into actionable daily routines.

CONVERSATION FLOW:
1. Listen to the user's goals, dreams, and current situation
2. Ask clarifying questions to understand their constraints (time, energy, commitments)
3. Review their existing schedule (provided below) to avoid conflicts
4. Only propose activities when you have enough information

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON in one of these formats:

For conversation (asking questions, discussing):
{"type": "conversation", "message": "Your response here..."}

For proposing activities (only when ready):
{"type": "proposal", "message": "Based on our conversation, here's your routine...", "activities": [
  {"title": "Activity name", "startTime": "HH:MM", "endTime": "HH:MM", "days": ["Monday", "Tuesday"], "description": "..."},
  ...
]}

GUIDELINES:
- Be warm, motivating, and realistic
- Ask about their wake/sleep times, work schedule, energy levels
- Consider their existing commitments before proposing new ones
- Start small - don't overwhelm with too many activities at once
- Use 24-hour time format (e.g., "06:00", "14:30")
- Days should be full names: "Monday", "Tuesday", etc.

NEVER respond with plain text - always use the JSON format above.`;

app.post("/api/chat/conversation", async (req, res) => {
    try {
        const { message, userId, accessToken, timeZone } = req.body;
        if (!message || !userId) {
            return res.status(400).json({ error: "message and userId required" });
        }

        // Get conversation history and schedule
        const { messages: history, schedule } = await tools.getConversationHistory(userId);

        // Save user's message
        await tools.saveConversationMessage(userId, "user", message);

        // Build conversation context for Gemini
        const conversationContext = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

        const scheduleContext = schedule.length > 0
            ? `\n\nUSER'S CURRENT SCHEDULE:\n${JSON.stringify(schedule.map(a => ({ title: a.title, days: a.days, startTime: a.startTime, endTime: a.endTime })), null, 2)}`
            : '\n\nUSER HAS NO EXISTING ACTIVITIES.';

        const fullPrompt = `${LIFE_PLANNER_PROMPT}
${scheduleContext}

CONVERSATION HISTORY:
${conversationContext}

User: ${message}

Respond with JSON only:`;

        console.log("Conversation: Processing message from", userId);

        try {
            const result = await generateContent(fullPrompt);
            const text = result.response.candidates[0].content.parts[0].text.trim();

            // Try to parse JSON from response
            let parsed;
            try {
                // Remove markdown code blocks if present
                const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanText);
            } catch (parseErr) {
                // If parsing fails, wrap as conversation
                console.warn("Failed to parse AI response as JSON, wrapping:", text);
                parsed = { type: "conversation", message: text };
            }

            // Save assistant's response
            await tools.saveConversationMessage(userId, "assistant", parsed.message || text);

            res.json({
                type: parsed.type || "conversation",
                message: parsed.message || text,
                activities: parsed.activities || null
            });

        } catch (err) {
            if (err.status === 429 || err.message?.includes("429")) {
                return res.json({
                    type: "conversation",
                    message: "I'm getting lots of requests right now! Please try again in a moment. ⏳"
                });
            }
            throw err;
        }

    } catch (err) {
        console.error("Conversation error:", err);
        res.status(500).json({ error: "Conversation failed: " + err.message });
    }
});

app.post("/api/chat/confirm", async (req, res) => {
    try {
        const { activities, userId, accessToken, timeZone } = req.body;
        if (!activities || !userId) {
            return res.status(400).json({ error: "activities and userId required" });
        }

        const context = { uid: userId, accessToken, timeZone };
        const results = [];

        for (const activity of activities) {
            try {
                // Normalize the activity data
                const normalized = normalizeAliases(activity);
                const safeArgs = normalizeAddActivityArgs(normalized);
                const result = await tools.addActivity(safeArgs, context);
                results.push({ success: true, activity: result.activity });
            } catch (err) {
                console.error("Error adding activity:", activity.title, err);
                results.push({ success: false, title: activity.title, error: err.message });
            }
        }

        // Clear conversation after successful confirmation
        await tools.clearConversation(userId);

        const successCount = results.filter(r => r.success).length;
        res.json({
            success: successCount > 0,
            message: `Added ${successCount} of ${activities.length} activities to your schedule!`,
            results,
            refreshNeeded: successCount > 0
        });

    } catch (err) {
        console.error("Confirm error:", err);
        res.status(500).json({ error: "Failed to confirm activities: " + err.message });
    }
});

app.post("/api/chat/clear", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        await tools.clearConversation(userId);
        res.json({ success: true, message: "Conversation cleared" });

    } catch (err) {
        console.error("Clear error:", err);
        res.status(500).json({ error: "Failed to clear conversation: " + err.message });
    }
});

// --------------------
// Debug Route
// --------------------
app.get("/api/debug", async (_, res) => {
    let firebaseStatus = "Unknown";
    try {
        const { firebaseReady } = require('./firebase-config');
        firebaseStatus = firebaseReady ? "Connected" : "Not Configured";
    } catch (e) { firebaseStatus = "Error loading module"; }

    const status = {
        vertexAIConfigured: !!(process.env.VERTEX_AI_PROJECT_ID && process.env.VERTEX_AI_LOCATION),
        vertexAIProject: process.env.VERTEX_AI_PROJECT_ID || 'Not Set',
        vertexAILocation: process.env.VERTEX_AI_LOCATION || 'Not Set',
        firebase: firebaseStatus,
        envFile: require("fs").existsSync(".env"),
        nodeVersion: process.version
    };
    res.json(status);
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});