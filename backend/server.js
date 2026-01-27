require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { admin, db } = require('./firebase-config');
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
    const { id, updates, userId, accessToken } = req.body;
    try {
        const result = await tools.updateActivity({ id, ...updates }, { uid: userId, accessToken });
        res.json(result);
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/activities/delete", async (req, res) => {
    const { id, userId, accessToken } = req.body;
    try {
        const result = await tools.deleteActivity({ id }, { uid: userId, accessToken });
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
        title: args.title || args.activity || args.task,
        startTime: args.startTime || args.time || args.at,
        endTime: args.endTime,
        duration: args.duration,
        description: args.description,
        location: args.location,
        id: args.id,
        query: args.query
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
        throw new Error("title and startTime are required");
    }

    if (!endTime && duration) {
        const match = duration.match(/(\d+)\s*(min|mins|minutes|hr|hour|hours)/i);
        if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            const start = parseTime(startTime);
            if (start) {
                const minutesToAdd = unit.startsWith("h") ? value * 60 : value;
                const end = new Date(start.getTime() + minutesToAdd * 60000);
                return {
                    ...args,
                    endTime: formatTime(end)
                };
            }
        }
    }

    if (!endTime) {
        throw new Error("endTime is required (or provide duration)");
    }

    return args;
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
  "arguments": {
    "title"?: string,
    "startTime"?: string,
    "endTime"?: string,
    "duration"?: string,
    "description"?: string,
    "location"?: string,
    "id"?: number,
    "query"?: string
  },
  "confidence": number
}

Mapping rules:
- "activity", "task", "event" → title
- "time", "at", "starts" → startTime
- "for X minutes/hours" → duration

Rules:
- If required fields are missing, still return best guess
- confidence must be between 0 and 1

User message:
"${message}"
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("Intent JSON parse failed:", text);
        return { intent: null, arguments: {}, confidence: 0 };
    }
}

// --------------------
// Tools (RTDB operations)
// --------------------
const tools = {
    async addActivity(args, context) {
        const ref = db.ref(`users/${context.userId}/schedule`).push();
        await ref.set({
            title: args.title,
            startTime: args.startTime,
            endTime: args.endTime,
            description: args.description || "",
            location: args.location || ""
        });
        return { success: true, id: ref.key };
    },

    async getSchedule(_, context) {
        const snapshot = await db.ref(`users/${context.userId}/schedule`).once("value");
        return snapshot.val() || {};
    }
};

// --------------------
// Chat API
// --------------------
app.post("/api/chat", async (req, res) => {
    try {
        const { message, userId } = req.body;
        if (!message || !userId) {
            return res.status(400).json({ error: "message and userId required" });
        }

        const { intent, arguments: rawArgs, confidence } = await extractIntent(message);
        console.log("INTENT:", intent, "CONFIDENCE:", confidence, "ARGS:", rawArgs);

        if (!intent || confidence < 0.6) {
            return res.json({ reply: "I’m not sure what you want to do.", refreshNeeded: false });
        }

        let result = null;
        let refreshNeeded = false;
        const context = { userId };

        switch (intent) {
            case "addActivity": {
                const aliasedArgs = normalizeAliases(rawArgs);
                const safeArgs = normalizeAddActivityArgs(aliasedArgs);
                result = await tools.addActivity(safeArgs, context);
                refreshNeeded = true;
                break;
            }

            case "getSchedule": {
                result = await tools.getSchedule({}, context);
                break;
            }

            default:
                return res.json({ reply: "That action isn’t supported yet.", refreshNeeded: false });
        }

        res.json({
            reply: "Done ✅",
            result,
            refreshNeeded
        });

    } catch (err) {
        console.error("Chat error:", err);
        res.status(500).json({ reply: err.message, refreshNeeded: false });
    }
});

// --------------------
// Debug Route
// --------------------
app.get("/api/debug", async (_, res) => {
    const { firebaseReady } = require('./firebase-config');
    const status = {
        geminiKeyPresent: !!process.env.GEMINI_API_KEY,
        firebaseConfigured: firebaseReady,
        envFile: require("fs").existsSync(".env"),
        render: !!process.env.RENDER,
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
