const admin = require('firebase-admin');

// TODO: Replace with your service account key path or object
// You can download this from Firebase Console > Project Settings > Service Accounts
// Save it as 'serviceAccountKey.json' in the backend directory
const serviceAccount = require('./serviceAccountKey.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Replace with your database URL
        databaseURL: "https://everyotherday-db39f-default-rtdb.firebaseio.com"
    });
    console.log("Firebase Admin initialized");
} catch (error) {
    console.error("Firebase Admin initialization failed:", error.message);
}

module.exports = admin;
