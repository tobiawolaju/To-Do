require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testKey() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY not found in .env file");
        return;
    }

    console.log(`🔑 Found API Key: ${apiKey.substring(0, 5)}...`);
    console.log("📡 Connecting to Gemini API...");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const result = await model.generateContent("Reply with 'Success' if you can read this.");
        const response = await result.response;
        const text = response.text();

        console.log("✅ API Key is VALID and working!");
        console.log("📝 Response from Gemini:", text);
    } catch (error) {
        console.error("Error testing API key:");
        const fs = require('fs');
        fs.writeFileSync('error_log.json', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
}

testKey();
