const admin = require('./firebase-config');
const { google } = require('googleapis');

const db = admin.database();

// Helper to get Google Calendar Client
function getCalendarClient(accessToken) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth });
}

const tools = {
    getSchedule: async (args, context) => {
        const { uid } = context;
        if (!uid) return { error: "User not authenticated" };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        return snapshot.val() || [];
    },

    addActivity: async ({ title, startTime, endTime, description, location, attendees }, context) => {
        const { uid, accessToken } = context;
        if (!uid) return { error: "User not authenticated" };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        const activities = snapshot.val() || [];

        // Handle activities being an object or array
        const activitiesArray = Array.isArray(activities) ? activities : Object.values(activities);
        const newId = activitiesArray.length > 0 ? Math.max(...activitiesArray.map(a => a.id)) + 1 : 1;

        const newActivity = {
            id: newId,
            title,
            startTime,
            endTime,
            description: description || "",
            location: location || "",
            attendees: attendees || [],
            status: "Pending",
            color: "#" + Math.floor(Math.random() * 16777215).toString(16)
        };

        // Add to Google Calendar
        if (accessToken) {
            try {
                const calendar = getCalendarClient(accessToken);
                const event = {
                    summary: title,
                    location: location,
                    description: description,
                    start: {
                        dateTime: convertToISO(startTime),
                        timeZone: 'UTC', // Ideally should use user's timezone
                    },
                    end: {
                        dateTime: convertToISO(endTime),
                        timeZone: 'UTC',
                    },
                    attendees: (attendees || []).map(email => ({ email })),
                };

                const res = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                });

                newActivity.googleEventId = res.data.id;
                newActivity.htmlLink = res.data.htmlLink;
                console.log("Event added to Google Calendar:", res.data.htmlLink);

            } catch (err) {
                console.error("Failed to add to Google Calendar:", err);
                // Continue adding to local DB even if Calendar fails
            }
        }

        // Save to Firebase
        // We'll use the ID as the key for easier updates/deletions if we convert to object structure, 
        // but for now let's append to list or use numeric ID mapping.
        // Actually, using push() is better for Firebase, but let's stick to array for compatibility with existing frontend logic if possible,
        // OR better: use ID as key.
        // The frontend expects an array. Let's rewrite the whole array for simplicity or update a specific node.
        // Rewriting whole array is inefficient but easiest for migration.

        activitiesArray.push(newActivity);
        await ref.set(activitiesArray);

        return { success: true, message: "Activity added.", activity: newActivity };
    },

    updateActivity: async ({ id, ...updates }, context) => {
        const { uid, accessToken } = context;
        if (!uid) return { error: "User not authenticated" };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const index = activities.findIndex(a => a.id === parseInt(id));

        if (index === -1) return { success: false, message: "Activity not found." };

        const originalActivity = activities[index];
        const updatedActivity = { ...originalActivity, ...updates };
        activities[index] = updatedActivity;

        // Update Google Calendar
        if (accessToken && originalActivity.googleEventId) {
            try {
                const calendar = getCalendarClient(accessToken);

                const eventPatch = {};
                if (updates.title) eventPatch.summary = updates.title;
                if (updates.description) eventPatch.description = updates.description;
                if (updates.location) eventPatch.location = updates.location;
                if (updates.startTime) eventPatch.start = { dateTime: convertToISO(updatedActivity.startTime) };
                if (updates.endTime) eventPatch.end = { dateTime: convertToISO(updatedActivity.endTime) };

                await calendar.events.patch({
                    calendarId: 'primary',
                    eventId: originalActivity.googleEventId,
                    resource: eventPatch,
                });
                console.log("Google Calendar event updated");
            } catch (err) {
                console.error("Failed to update Google Calendar:", err);
            }
        }

        await ref.set(activities);
        return { success: true, message: "Activity updated.", activity: updatedActivity };
    },

    deleteActivity: async ({ id }, context) => {
        const { uid, accessToken } = context;
        if (!uid) return { error: "User not authenticated" };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const activityToDelete = activities.find(a => a.id === parseInt(id));
        if (!activityToDelete) return { success: false, message: "Activity not found." };

        const newActivities = activities.filter(a => a.id !== parseInt(id));

        // Delete from Google Calendar
        if (accessToken && activityToDelete.googleEventId) {
            try {
                const calendar = getCalendarClient(accessToken);
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: activityToDelete.googleEventId,
                });
                console.log("Google Calendar event deleted");
            } catch (err) {
                console.error("Failed to delete from Google Calendar:", err);
            }
        }

        await ref.set(newActivities);
        return { success: true, message: "Activity deleted." };
    },

    findHackathons: async ({ query }) => {
        return {
            success: true,
            message: `Found hackathons for query: "${query}"`,
            results: [
                { title: "Global AI Hackathon", date: "2026-02-14", link: "https://globalai.example.com" },
                { title: "Web3 Builder Jam", date: "2026-03-01", link: "https://web3jam.example.com" },
                { title: "Green Tech Challenge", date: "2026-04-22", link: "https://greentech.example.com" }
            ]
        };
    }
};

// Helper: Convert HH:MM to ISO string for today
function convertToISO(timeStr) {
    if (!timeStr) return undefined;
    const now = new Date();
    const [hours, minutes] = timeStr.split(':');
    now.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return now.toISOString();
}

module.exports = tools;
