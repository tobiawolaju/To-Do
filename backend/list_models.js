require('dotenv').config();

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    console.log("Fetching models...");
    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            console.error("API Error:");
            console.error(JSON.stringify(data.error, null, 2));
            const fs = require('fs');
            fs.writeFileSync('models_error.json', JSON.stringify(data.error, null, 2));
        } else {
            console.log("Available Models:");
            const names = (data.models || []).map(m => m.name);
            console.log(names);

            const fs = require('fs');
            fs.writeFileSync('models_list.json', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

listModels();
