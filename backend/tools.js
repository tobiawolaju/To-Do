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
    if (!days || !Array.isArray(days) || days.length === 0) return null;

    // Normalize casing: "monday" -> "Monday"
    const normalizedDays = days.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

    const dayMap = {
        "Monday": "MO", "Tuesday": "TU", "Wednesday": "WE",
        "Thursday": "TH", "Friday": "FR", "Saturday": "SA", "Sunday": "SU"
    };

    const byDay = normalizedDays.map(d => dayMap[d]).filter(d => d).join(',');
    console.log("Sync Trace: Days in:", JSON.stringify(days), "BYDAY:", byDay);

    if (!byDay) return null;

    // Using WEEKLY with INTERVAL=1 ensures it shows up as "Custom" / "Weekly" in Calendar UI
    const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDay};WKST=MO`;
    return [rrule];
}

// Helper: Convert HH:MM to ISO string with Offset (RFC3339)
function convertToISO(timeStr, timeZone = 'UTC') {
    if (!timeStr) return undefined;

    const now = new Date();
    // Get date parts in target timezone
    const partFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    });

    // Get offset in target timezone (e.g. "GMT+01:00")
    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset'
    });

    const parts = partFormatter.formatToParts(now);
    const dateParts = {};
    parts.forEach(({ type, value }) => { dateParts[type] = value; });

    const offsetParts = offsetFormatter.formatToParts(now);
    const gmtOffset = offsetParts.find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    // Map "GMT+01:00" or "GMT-05:00" to "+01:00" or "-05:00"
    const offset = gmtOffset.replace('GMT', '') || '+00:00';

    const [hours, minutes] = timeStr.split(':');
    const isoStr = `${dateParts.year}-${dateParts.month.padStart(2, '0')}-${dateParts.day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00${offset}`;

    console.log(`Sync Trace: Timezone ${timeZone} -> Offset ${offset} -> ISO ${isoStr}`);
    return isoStr;
}

const tools = {
    getSchedule: async (args, context) => {
        const { uid } = context;
        if (!uid) return { success: false, error: "User not authenticated" };
        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        const val = snapshot.val();
        return val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    },

    addActivity: async ({ title, startTime, endTime, description, location, attendees, tags, days }, context) => {
        const { uid, accessToken, timeZone } = context;
        if (!uid) return { success: false, error: "User not authenticated" };

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        const activities = snapshot.val() || [];
        const activitiesArray = Array.isArray(activities) ? activities : Object.values(activities);

        const existingIds = activitiesArray.map(a => parseInt(a.id)).filter(id => !isNaN(id));
        const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        const normalizedDays = (days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

        const newActivity = {
            id: newId,
            title,
            startTime,
            endTime,
            description: description || "",
            location: location || "",
            attendees: attendees || [],
            tags: tags || [],
            days: normalizedDays.length > 0 ? normalizedDays : [new Date().toLocaleDateString('en-US', { weekday: 'long' })],
            status: "Pending",
            color: "#" + Math.floor(Math.random() * 16777215).toString(16)
        };

        let calendarSync = { success: true };

        if (accessToken) {
            try {
                const calendar = getCalendarClient(accessToken);
                const recurrence = getRRULE(newActivity.days);

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
                    attendees: (attendees || []).map(email => ({ email })),
                };

                if (recurrence) {
                    event.recurrence = recurrence;
                }

                console.log("Sync Trace: Sending to Google (Insert):", JSON.stringify(event, null, 2));

                const res = await calendar.events.insert({
                    calendarId: 'primary',
                    resource: event,
                });

                newActivity.googleEventId = res.data.id;
                newActivity.htmlLink = res.data.htmlLink;
                console.log(`Sync Trace: Success! Event ID: ${res.data.id}`);

            } catch (err) {
                console.error("Sync Trace: FAIL (Insert):", err.message);
                calendarSync = { success: false, error: err.message };
            }
        }

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

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const index = activities.findIndex(a => a.id === parseInt(id));
        if (index === -1) return { success: false, message: "Activity not found." };

        const originalActivity = activities[index];
        const updatedActivity = { ...originalActivity, ...updates };

        if (updates.days) {
            updatedActivity.days = updates.days.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());
        }

        activities[index] = updatedActivity;

        let calendarSync = { success: true };

        if (accessToken) {
            try {
                const calendar = getCalendarClient(accessToken);

                // Construct the event object for Google
                const event = {
                    summary: updatedActivity.title,
                    location: updatedActivity.location,
                    description: updatedActivity.description,
                    start: {
                        dateTime: convertToISO(updatedActivity.startTime, timeZone),
                        timeZone: timeZone || 'UTC'
                    },
                    end: {
                        dateTime: convertToISO(updatedActivity.endTime, timeZone),
                        timeZone: timeZone || 'UTC'
                    },
                    recurrence: getRRULE(updatedActivity.days),
                    attendees: (updatedActivity.attendees || []).map(email => ({ email })),
                };

                if (originalActivity.googleEventId) {
                    console.log(`Sync Trace: Sending to Google (Patch): ${originalActivity.googleEventId}`);
                    await calendar.events.patch({
                        calendarId: 'primary',
                        eventId: originalActivity.googleEventId,
                        resource: event,
                    });
                    console.log("Sync Trace: Google Calendar event updated.");
                } else {
                    // Recovery mode: Create the event if it's missing from Google
                    console.log("Sync Trace: Scaling recovery mode (Insert missing event).");
                    const res = await calendar.events.insert({
                        calendarId: 'primary',
                        resource: event,
                    });
                    updatedActivity.googleEventId = res.data.id;
                    updatedActivity.htmlLink = res.data.htmlLink;
                    console.log(`Sync Trace: Success (Recovery Insert)! Event ID: ${res.data.id}`);
                }
            } catch (err) {
                console.error("Sync Trace: FAIL (Update):", err.message);
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

        const ref = db.ref(`users/${uid}/schedule`);
        const snapshot = await ref.once('value');
        let activities = snapshot.val() || [];
        if (!Array.isArray(activities)) activities = Object.values(activities);

        const activityToDelete = activities.find(a => a.id === parseInt(id));
        if (!activityToDelete) return { success: false, message: "Activity not found." };

        const newActivities = activities.filter(a => a.id !== parseInt(id));

        let calendarSync = { success: true };

        if (accessToken && activityToDelete.googleEventId) {
            try {
                const calendar = getCalendarClient(accessToken);
                console.log(`Sync Trace: Sending to Google (Delete): ${activityToDelete.googleEventId}`);
                await calendar.events.delete({
                    calendarId: 'primary',
                    eventId: activityToDelete.googleEventId,
                });
                console.log("Sync Trace: Google Calendar event deleted.");
            } catch (err) {
                console.error("Sync Trace: FAIL (Delete):", err.message);
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
            results: [
                { title: "Global AI Hackathon", date: "2026-02-14", link: "https://globalai.example.com" },
                { title: "Web3 Builder Jam", date: "2026-03-01", link: "https://web3jam.example.com" }
            ]
        };
    }
};

module.exports = tools;