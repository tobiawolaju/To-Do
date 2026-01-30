const { db } = require('./firebase-config');
const { google } = require('googleapis');

// Helper to get Google Calendar Client
function getCalendarClient(accessToken) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth });
}

// Helper: Convert user-friendly days to Google Calendar RRULE
function getRRULE(days) {
    if (!days || days.length === 0) return null;

    const dayMap = {
        "Monday": "MO", "Tuesday": "TU", "Wednesday": "WE",
        "Thursday": "TH", "Friday": "FR", "Saturday": "SA", "Sunday": "SU"
    };

    const byDay = days.map(d => dayMap[d]).filter(d => d).join(',');
    if (!byDay) return null;

    // Using WEEKLY with INTERVAL=1 ensures it shows up as "Custom" / "Weekly" in Calendar UI
    // even if it's every day, which helps users identify it as a repeating series.
    const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDay}`;
    return [rrule];
}

// Helper: Convert HH:MM to ISO string for today, respecting the user's timezone
function convertToISO(timeStr, timeZone = 'UTC') {
    if (!timeStr) return undefined;

    // Get current date in the user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const dateParts = {};
    parts.forEach(({ type, value }) => { dateParts[type] = value; });

    const [hours, minutes] = timeStr.split(':');

    // Construct the date object correctly for that timezone
    // Note: This is a robust way to handle "today at HH:mm" in a target timezone
    const isoStr = `${dateParts.year}-${dateParts.month.padStart(2, '0')}-${dateParts.day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;

    // Google Calendar API will handle the offset if we provide the timeZone separately, 
    // but the dateTime should be in a valid RFC3339 format (often just the local time works if TZ is specified).
    return isoStr;
}

const tools = {
    getSchedule: async (args, context) => {
        const { uid } = context;
        if (!uid) return { success: false, error: "User not authenticated" };
        if (!db) return { success: false, error: "Database not initialized. Check server config." };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        const val = snapshot.val();
        // Return array whether it's stored as object or array
        return val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    },

    addActivity: async ({ title, startTime, endTime, description, location, attendees, tags, days }, context) => {
        const { uid, accessToken, timeZone } = context;
        if (!uid) return { success: false, error: "User not authenticated" };
        if (!db) return { success: false, error: "Database not initialized. Check server config." };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        const activities = snapshot.val() || [];

        // Handle activities being an object or array in DB
        const activitiesArray = Array.isArray(activities) ? activities : Object.values(activities);

        // Robust ID generation: Find max ID and add 1
        const existingIds = activitiesArray.map(a => parseInt(a.id)).filter(id => !isNaN(id));
        const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        const newActivity = {
            id: newId,
            title,
            startTime,
            endTime,
            description: description || "",
            location: location || "",
            attendees: attendees || [],
            tags: tags || [],
            days: days || [new Date().toLocaleDateString('en-US', { weekday: 'long' })],
            status: "Pending",
            color: "#" + Math.floor(Math.random() * 16777215).toString(16) // Random Hex Color
        };

        let calendarSync = { success: true };

        // Add to Google Calendar
        if (accessToken) {
            try {
                const calendar = getCalendarClient(accessToken);
                const event = {
                    summary: title,
                    location: location,
                    description: description,
                    start: {
                        dateTime: convertToISO(startTime, timeZone),
                        timeZone: timeZone || 'UTC',
                    },
                    end: {
                        dateTime: convertToISO(endTime, timeZone),
                        timeZone: timeZone || 'UTC',
                    },
                    recurrence: getRRULE(days),
                    attendees: (attendees || []).map(email => ({ email })),
                };

                const res = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                });

                newActivity.googleEventId = res.data.id;
                newActivity.htmlLink = res.data.htmlLink;
                console.log(`Event '${title}' added to Google Calendar.`);

            } catch (err) {
                console.error("Failed to add to Google Calendar:", err.message);
                calendarSync = { success: false, error: err.message };
            }
        }

        // Save to Firebase
        activitiesArray.push(newActivity);
        await ref.set(activitiesArray);

        return {
            success: true,
            message: calendarSync.success ? "Activity added and synced." : "Activity added to DB, but Calendar sync failed.",
            activity: newActivity,
            calendarError: calendarSync.error
        };
    },

    updateActivity: async ({ id, ...updates }, context) => {
        const { uid, accessToken, timeZone } = context;
        if (!uid) return { success: false, error: "User not authenticated" };
        if (!db) return { success: false, error: "Database not initialized. Check server config." };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const index = activities.findIndex(a => a.id === parseInt(id));

        if (index === -1) return { success: false, message: "Activity not found." };

        const originalActivity = activities[index];
        const updatedActivity = { ...originalActivity, ...updates };
        activities[index] = updatedActivity;

        let calendarSync = { success: true };

        // Update Google Calendar
        if (accessToken && originalActivity.googleEventId) {
            try {
                const calendar = getCalendarClient(accessToken);
                const eventPatch = {};
                if (updates.title) eventPatch.summary = updates.title;
                if (updates.description) eventPatch.description = updates.description;
                if (updates.location) eventPatch.location = updates.location;
                if (updates.startTime) eventPatch.start = {
                    dateTime: convertToISO(updatedActivity.startTime, timeZone),
                    timeZone: timeZone || 'UTC'
                };
                if (updates.endTime) eventPatch.end = {
                    dateTime: convertToISO(updatedActivity.endTime, timeZone),
                    timeZone: timeZone || 'UTC'
                };
                if (updates.days) {
                    eventPatch.recurrence = getRRULE(updatedActivity.days);
                }

                await calendar.events.patch({
                    calendarId: 'primary',
                    eventId: originalActivity.googleEventId,
                    resource: eventPatch,
                });
                console.log("Google Calendar event updated");
            } catch (err) {
                console.error("Failed to update Google Calendar:", err.message);
                calendarSync = { success: false, error: err.message };
            }
        }

        await ref.set(activities);
        return {
            success: true,
            message: calendarSync.success ? "Activity updated." : "Updated in DB, but Calendar update failed.",
            activity: updatedActivity,
            calendarError: calendarSync.error
        };
    },

    deleteActivity: async ({ id }, context) => {
        const { uid, accessToken } = context;
        if (!uid) return { success: false, error: "User not authenticated" };
        if (!db) return { success: false, error: "Database not initialized. Check server config." };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const activityToDelete = activities.find(a => a.id === parseInt(id));
        if (!activityToDelete) return { success: false, message: "Activity not found." };

        const newActivities = activities.filter(a => a.id !== parseInt(id));

        let calendarSync = { success: true };

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
                console.error("Failed to delete from Google Calendar:", err.message);
                calendarSync = { success: false, error: err.message };
            }
        }

        await ref.set(newActivities);
        return {
            success: true,
            message: calendarSync.success ? "Activity deleted." : "Deleted from DB, but Calendar deletion failed.",
            calendarError: calendarSync.error
        };
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

module.exports = tools;