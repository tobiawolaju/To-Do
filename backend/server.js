require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const tools = require('./tools');
const admin = require('./firebase-config');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define Function Declarations for Gemini
const toolDeclarations = [
    {
        name: "getSchedule",
        description: "Get the current daily schedule of activities",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "addActivity",
        description: "Add a new activity to the schedule",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING", description: "Title of the activity" },
                startTime: { type: "STRING", description: "Start time in HH:MM (24h) format" },
                endTime: { type: "STRING", description: "End time in HH:MM (24h) format" },
                description: { type: "STRING", description: "Description details" },
                location: { type: "STRING", description: "Location" },
                attendees: { type: "ARRAY", items: { type: "STRING" }, description: "List of attendee names" }
            },
            required: ["title", "startTime", "endTime"]
        }
    },
    {
        name: "updateActivity",
        description: "Update an existing activity",
        parameters: {
            type: "OBJECT",
            properties: {
                id: { type: "NUMBER", description: "ID of the activity to update" },
                title: { type: "STRING" },
                startTime: { type: "STRING" },
                endTime: { type: "STRING" },
                description: { type: "STRING" },
                location: { type: "STRING" },
                status: { type: "STRING" }
            },
            required: ["id"]
        }
    },
    {
        name: "deleteActivity",
        description: "Delete an activity by ID",
        parameters: {
            type: "OBJECT",
            properties: {
                id: { type: "NUMBER", description: "ID of the activity to delete" }
            },
            required: ["id"]
        }
    },
    {
        name: "findHackathons",
        description: "Find hackathons based on criteria",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "Search query for hackathons" }
            },
            required: ["query"]
        }
    },
];

app.post('/api/chat', async (req, res) => {
    try {
        const { message, idToken, accessToken } = req.body;

        if (!idToken) {
            return res.status(401).json({ reply: "Unauthorized. Please sign in." });
        }

        let uid;
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            uid = decodedToken.uid;
        } catch (authError) {
            console.error("Auth Error:", authError);
            return res.status(401).json({ reply: "Invalid session. Please sign in again." });
        }

        // Use Gemini Pro model
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const chat = model.startChat({
            tools: [{ functionDeclarations: toolDeclarations }],
        });

        const result = await chat.sendMessage(message);
        const response = result.response;
        const functionCalls = response.functionCalls();

        let finalResponseText = response.text();
        let refreshNeeded = false;

        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                const fnName = call.name;
                const fnArgs = call.args;

                let toolResult;
                if (tools[fnName]) {
                    console.log(`Executing tool: ${fnName} for user ${uid}`, fnArgs);

                    // Pass user context (uid, accessToken) to tools
                    const context = { uid, accessToken };
                    try {
                        toolResult = await tools[fnName](fnArgs, context);
                    } catch (err) {
                        console.error(`Tool execution error: ${err.message}`);
                        toolResult = { error: err.message };
                    }

                    if (['addActivity', 'updateActivity', 'deleteActivity'].includes(fnName)) {
                        refreshNeeded = true;
                    }
                } else {
                    toolResult = { error: `Function ${fnName} not found` };
                }

                const resultChat = await chat.sendMessage([{
                    functionResponse: {
                        name: fnName,
                        response: { content: toolResult }
                    }
                }]);

                finalResponseText = resultChat.response.text();
            }
        }

        res.json({
            reply: finalResponseText || "Processed.",
            refreshNeeded
        });

    } catch (error) {
        console.error("Error in chat endpoint:", error);
        res.status(500).json({ reply: "Sorry, I encountered an error processing your request." });
    }
});

app.get('/api/debug', async (req, res) => {
    const status = {
        geminiKeyPresent: !!process.env.GEMINI_API_KEY,
        firebaseConfigured: !!admin.apps.length,
        serviceAccount: !!require('./serviceAccountKey.json'),
        envFile: require('fs').existsSync('.env')
    };

    try {
        await admin.auth().listUsers(1);
        status.firebaseAuth = "Connected";
    } catch (e) {
        status.firebaseAuth = "Error: " + e.message;
    }

    res.json(status);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
