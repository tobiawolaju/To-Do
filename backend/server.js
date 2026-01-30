require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const tools = require('./tools');

// --------------------
// Gemini Chat Route
// --------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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

// Map "tags" -> tags (array of strings) if present.

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
- "on Mondays", "every Tuesday", "weekdays", "daily" → days (array of strings, e.g., ["Monday", "Tuesday"])// if user says to tommrow, gigure out the right day if it is monday -sunday and use that, dont use users adjective of day

MULTIPLE TASKS:
If the user wants to add multiple activities (e.g., "Swim at 10pm AND Read at 8am"),
set "intent" to "addActivity" and make "arguments" an ARRAY of objects.
Example: "arguments": [{ "title": "Swim", "time": "10pm" }, { "title": "Read", "time": "8am", "tags": ["study"] }]

Rules:
- If required fields are missing, still return best guess
- confidence must be between 0 and 1

User message:
"${message}"
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
        // Clean markdown code blocks if AI adds them
        const jsonText = text.replace(/```json/g, "").replace(/```/g, "");
        return JSON.parse(jsonText);
    } catch (err) {
        console.error("Intent JSON parse failed:", text);
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

        if (!intent || confidence < 0.6) {
            return res.json({ reply: "I’m not sure what you want to do.", refreshNeeded: false });
        }

        let result = null;
        let refreshNeeded = false;
        let reply = "Done ✅";
        const context = { uid: userId, accessToken, timeZone };

        switch (intent) {
            case "addActivity": {
                // Handle Single Object or Array of Objects
                const argsList = Array.isArray(rawArgs) ? rawArgs : [rawArgs];
                const responses = [];

                // Process sequentially to prevent Database ID race conditions
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

                // Create a summary message
                const successCount = responses.filter(r => r.success).length;
                const failCount = responses.length - successCount;

                if (successCount > 0 && failCount === 0) {
                    reply = responses.length > 1 ? "Done! I've added all your tasks." : "Done! Added the activity.";
                } else if (successCount > 0 && failCount > 0) {
                    reply = `Partially successful. Added ${successCount} tasks, but ${failCount} failed.`;
                } else {
                    const firstError = responses[0]?.error || "Unknown error";
                    reply = `I couldn't add that. Error: ${firstError}`;
                }

                result = {
                    message: `Processed ${responses.length} requests.`,
                    details: responses
                };
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
            res.json({
                reply,
                result,
                refreshNeeded
            });
        }

    } catch (err) {
        console.error("Chat error:", err);
        if (!res.headersSent) {
            res.status(500).json({ reply: "An error occurred: " + err.message, refreshNeeded: false });
        }
    }
});

// --------------------
// Debug Route
// --------------------
app.get("/api/debug", async (_, res) => {
    // Basic check without crashing if firebase-config isn't perfectly set up in dev
    let firebaseStatus = "Unknown";
    try {
        const { firebaseReady } = require('./firebase-config');
        firebaseStatus = firebaseReady ? "Connected" : "Not Configured";
    } catch (e) { firebaseStatus = "Error loading module"; }

    const status = {
        geminiKeyPresent: !!process.env.GEMINI_API_KEY,
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