import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

const CONFIG = {
    startHour: 0,
    endHour: 24,
    minZoom: 0.1,  // Roughly 24h in view
    maxZoom: 5.0,
    zoomStep: 0.1
};

let currentZoom = 1.0;

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDy7BCBM_WnfjLffKOQDup-Y6jRC_RoePA",
    authDomain: "everyotherday-db39f.firebaseapp.com",
    databaseURL: "https://everyotherday-db39f-default-rtdb.firebaseio.com",
    projectId: "everyotherday-db39f",
    storageBucket: "everyotherday-db39f.firebasestorage.app",
    messagingSenderId: "879562247905",
    appId: "1:879562247905:web:afa33c4295e4db98d3f1a0",
    measurementId: "G-Y6Z2ZDNJQW"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();
// Add scopes for Google Calendar
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let currentUser = null;
let googleAccessToken = null;

// --- Auth Functions ---

function initAuth() {
    const signInBtn = document.getElementById('params-signin-btn');
    const signOutBtn = document.getElementById('signout-btn');
    const userProfile = document.getElementById('user-profile');
    const userPhoto = document.getElementById('user-photo');

    userProfile.addEventListener('click', (e) => {
        // Only redirect if they didn't click the signout button
        if (!e.target.closest('#signout-btn')) {
            window.location.href = 'dashboard.html';
        }
    });

    signInBtn.addEventListener('click', () => {
        auth.signInWithPopup(provider).then((result) => {
            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = result.credential;
            googleAccessToken = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            console.log("User signed in:", user.displayName);
        }).catch((error) => {
            console.error("Sign in error:", error);
            alert("Sign in failed: " + error.message);
        });
    });

    signOutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log("User signed out");
            googleAccessToken = null;
        });
    });

    auth.onAuthStateChanged((user) => {
        currentUser = user;
        if (user) {
            // UI Updates
            signInBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userPhoto.src = user.photoURL;

            // Load Data
            loadUserSchedule(user.uid);
        } else {
            // UI Updates
            signInBtn.classList.remove('hidden');
            userProfile.classList.add('hidden');

            // Clear Data
            document.getElementById('tracks-container').innerHTML = '';
        }
    });
}

function loadUserSchedule(uid) {
    const scheduleRef = database.ref('users/' + uid + '/schedule');
    scheduleRef.on('value', (snapshot) => {
        const activities = snapshot.val() || {};

        // Convert object to array and ensure we have an 'id' that matches backend expectations
        const activitiesArray = Object.keys(activities).map(key => {
            const data = activities[key];
            return {
                ...data,
                id: data.id || key // Prefer internal ID if set by backend tools
            };
        });

        document.getElementById('tracks-container').innerHTML = '';
        renderTimeRuler();
        layoutAndRenderActivities(activitiesArray);
    });
}

function renderAttendeesHtml(attendees) {
    if (!attendees || attendees.length === 0) return '';

    const attendeesHtml = attendees.map(name => `<span class="attendee-chip">${name}</span>`).join('');
    return `
        <div class="detail-item">
            <h3>Attendees</h3>
            <div class="attendees-list">
                ${attendeesHtml}
            </div>
        </div>
    `;
}

function renderTagsHtml(tags) {
    const tagsList = tags || [];
    const tagsHtml = tagsList.length > 0
        ? tagsList.map(tag => `<span class="tag-chip">${tag}</span>`).join('')
        : '<span class="no-tags">No tags</span>';

    return `
        <div class="detail-item">
            <h3>Tags</h3>
            <div class="tags-list">
                ${tagsHtml}
            </div>
        </div>
    `;
}

function renderDetails(activity) {
    const panel = document.getElementById('details-panel');
    const overlay = document.getElementById('details-overlay');

    // Status color mapping
    const statusColors = {
        'Completed': '#4CAF50',
        'In Progress': '#2196F3',
        'Pending': '#FFC107',
        'Missed': '#F44336'
    };
    const statusColor = statusColors[activity.status] || '#999';

    panel.innerHTML = `
        <div class="detail-container">
            <div class="detail-header">
                <div class="detail-title-row">
                    <h2>${activity.title}</h2>
                    <span class="status-chip" style="background-color: ${hexToRgba(statusColor, 0.1)}; color: ${statusColor}; border: 1px solid ${hexToRgba(statusColor, 0.3)}">${activity.status || 'Scheduled'}</span>
                </div>
                <div class="detail-time">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    ${activity.startTime} - ${activity.endTime}
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Description</h3>
                <p>${activity.description || 'No description provided.'}</p>
            </div>
            
            <div class="detail-grid">
                <div class="detail-item">
                    <h3>Location</h3>
                    <div class="detail-value">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${activity.location || 'N/A'}
                    </div>
                </div>
                
                ${renderAttendeesHtml(activity.attendees)}

                ${renderTagsHtml(activity.tags)}
            </div>

    <div class="detail-actions">
        <button class="action-button primary" id="edit-btn">Edit</button>
        <button class="action-button secondary" id="delete-btn">Delete</button>
    </div>
        </div>
    `;

    // Button Listeners
    panel.querySelector('#delete-btn').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${activity.title}" ? `)) {
            deleteActivity(activity.id);
        }
    });

    panel.querySelector('#edit-btn').addEventListener('click', () => {
        editActivity(activity);
    });

    // Open sheet on mobile
    panel.classList.add('open');
    overlay.classList.add('active');
    document.querySelector('.chat-input-container').classList.add('hidden-mobile');
}

function editActivity(activity) {
    const panel = document.getElementById('details-panel');
    panel.innerHTML = `
    <div class="edit-container">
            <h3>Edit Activity</h3>
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="edit-title" value="${activity.title}">
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Start Time</label>
                    <input type="time" id="edit-start" value="${activity.startTime}">
                </div>
                <div class="form-group">
                    <label>End Time</label>
                    <input type="time" id="edit-end" value="${activity.endTime}">
                </div>
            </div>
            <div class="form-group">
                <label>Location</label>
                <input type="text" id="edit-location" value="${activity.location || ''}">
            </div>
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" id="edit-tags" value="${(activity.tags || []).join(', ')}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="edit-description">${activity.description || ''}</textarea>
            </div>
            <div class="detail-actions">
                <button class="action-button primary" id="save-edit">Save Changes</button>
                <button class="action-button secondary" id="cancel-edit">Cancel</button>
            </div>
        </div>
    `;

    document.getElementById('cancel-edit').addEventListener('click', () => {
        renderDetails(activity);
    });

    document.getElementById('save-edit').addEventListener('click', async () => {
        const saveBtn = document.getElementById('save-edit');
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        const updatedData = {
            title: document.getElementById('edit-title').value,
            startTime: document.getElementById('edit-start').value,
            endTime: document.getElementById('edit-end').value,
            location: document.getElementById('edit-location').value,
            description: document.getElementById('edit-description').value,
            tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(t => t),
            status: activity.status || 'Scheduled'
        };

        await updateActivity(activity.id, updatedData);
    });
}

async function updateActivity(activityId, data) {
    if (!currentUser) return;
    const saveBtn = document.getElementById('save-edit');

    try {
        const response = await fetch("https://to-do-iun8.onrender.com/api/activities/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: activityId,
                updates: data,
                userId: currentUser.uid,
                accessToken: googleAccessToken
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to update activity");
        }

        // Success - close the panel (Firebase listener will update the UI)
        closeDetails();

    } catch (error) {
        console.error("Error updating activity:", error);
        alert("Failed to update activity: " + error.message);

        // Reset button state on error
        if (saveBtn) {
            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }
    }
}

async function deleteActivity(activityId) {
    if (!currentUser) return;
    try {
        const response = await fetch("https://to-do-iun8.onrender.com/api/activities/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: activityId,
                userId: currentUser.uid,
                accessToken: googleAccessToken
            })
        });

        if (!response.ok) throw new Error("Failed to delete activity");

        closeDetails();
    } catch (error) {
        console.error("Error deleting activity:", error);
        alert("Failed to delete activity.");
    }
}

function closeDetails() {
    const panel = document.getElementById('details-panel');
    const overlay = document.getElementById('details-overlay');
    panel.classList.remove('open');
    overlay.classList.remove('active');
    document.querySelector('.chat-input-container').classList.remove('hidden-mobile');
}

function init() {
    renderTimeRuler();
    setupCurrentTimeIndicator();
    scrollToInitialTime();
    setupChatInput();
    setupZoomListeners();
    initAuth(); // Initialize auth listeners

    // Close details when clicking overlay
    document.getElementById('details-overlay').addEventListener('click', closeDetails);

    // Splash Screen Timer (2.5s)
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('fade-out');
    }, 2500);

    // Set date
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
}



function setupChatInput() {
    const input = document.getElementById('chat-input');
    const actionBtn = document.getElementById('action-btn');
    const micIcon = actionBtn.querySelector('.icon-mic');
    const sendIcon = actionBtn.querySelector('.icon-send');

    // Toggle send/mic icon based on input
    function updateIcon() {
        if (input.value.trim().length > 0) {
            micIcon.classList.add('hidden');
            sendIcon.classList.remove('hidden');
            actionBtn.setAttribute('aria-label', 'Send message');
        } else {
            sendIcon.classList.add('hidden');
            micIcon.classList.remove('hidden');
            actionBtn.setAttribute('aria-label', 'Voice input');
        }
    }

    async function sendMessage() {
        if (!currentUser) {
            alert("Please sign in to use the AI assistant.");
            return;
        }

        const message = input.value.trim();
        if (!message) return;

        console.log("Sending message:", message);
        input.value = '';
        updateIcon();

        const originalPlaceholder = input.placeholder;
        input.placeholder = "Thinking...";
        input.disabled = true;

        try {
            // Get current Firebase ID token
            const idToken = await currentUser.getIdToken();

            const response = await fetch("https://to-do-iun8.onrender.com/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    userId: currentUser.uid,   // <-- required by backend
                    accessToken: googleAccessToken || null
                })
            });



            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Backend error:", errData);
                alert("Error: " + (errData.reply || errData.error || "Unknown error"));
                return;
            }

            const data = await response.json();
            console.log("AI Reply:", data.reply);

            // Show AI reply
            if (data.reply) {
                alert("AI: " + data.reply);
            } else {
                alert("AI returned no message.");
            }

        } catch (error) {
            console.error("Error communicating with AI:", error);
            alert("Error communicating with AI Assistant. Make sure backend is running.");
        } finally {
            input.placeholder = originalPlaceholder;
            input.disabled = false;
            input.focus();
        }
    }

    input.addEventListener("input", updateIcon);

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value.trim().length > 0) {
            sendMessage();
        }
    });

    actionBtn.addEventListener("click", () => {
        if (!sendIcon.classList.contains("hidden")) {
            sendMessage();
        } else {
            console.log("Voice input triggered (not implemented)");
        }
    });
}

function setupZoomListeners() {
    const timeline = document.querySelector('.timeline-container');
    let lastTouchDistance = 0;

    // Mouse Wheel Zoom (Ctrl + Wheel)
    timeline.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            applyZoom(currentZoom * factor, e.clientX);
        }
    }, { passive: false });

    // Touch Pinch Zoom
    timeline.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            lastTouchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    });

    timeline.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const factor = distance / lastTouchDistance;

            applyZoom(currentZoom * factor, centerX);
            lastTouchDistance = distance;
        }
    }, { passive: false });
}

function applyZoom(newZoom, centerX = window.innerWidth / 2) {
    const timeline = document.querySelector('.timeline-container');
    const oldZoom = currentZoom;

    // Clamp zoom
    currentZoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, newZoom));

    if (oldZoom === currentZoom) return;

    // Calculate mouse position relative to content to maintain focus
    const rect = timeline.getBoundingClientRect();
    const relativeX = centerX - rect.left + timeline.scrollLeft;
    const ratio = currentZoom / oldZoom;

    // Apply zoom to CSS
    document.documentElement.style.setProperty('--zoom-level', currentZoom);

    // Adjust scroll to keep focus point
    timeline.scrollLeft = relativeX * ratio - (centerX - rect.left);
}



function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} `;
}

function renderTimeRuler() {
    const ruler = document.getElementById('time-ruler');
    // Clear existing to prevent duplicates if re-rendering
    ruler.innerHTML = '';
    for (let i = CONFIG.startHour; i < CONFIG.endHour; i++) {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.textContent = `${String(i).padStart(2, '0')}:00`;
        ruler.appendChild(marker);
    }
}

function layoutAndRenderActivities(activities) {
    if (!activities) return;

    // 1. Sort by start time
    const sorted = [...activities].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

    // 2. Assign tracks
    const tracks = [];

    sorted.forEach(activity => {
        const start = parseTime(activity.startTime);
        let placed = false;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const lastActivityInTrack = track[track.length - 1];
            const lastEnd = parseTime(lastActivityInTrack.endTime);

            if (start >= lastEnd) {
                track.push(activity);
                activity.trackIndex = i;
                placed = true;
                break;
            }
        }

        if (!placed) {
            tracks.push([activity]);
            activity.trackIndex = tracks.length - 1;
        }
    });

    // 3. Render
    const container = document.getElementById('tracks-container');
    const trackHeight = 80; // Match CSS
    const trackGap = 16;  // Match CSS

    container.style.height = `${tracks.length * (trackHeight + trackGap)}px`;

    sorted.forEach(activity => {
        const el = document.createElement('div');
        el.className = 'activity-block';
        el.innerHTML = `
    <div class="activity-title">${activity.title}</div>
        <div class="activity-time">${activity.startTime} - ${activity.endTime}</div>
`;

        const start = parseTime(activity.startTime);
        const end = parseTime(activity.endTime);
        const duration = end - start;

        // Use CSS variables for time-based positioning
        el.style.left = `calc(${start} * var(--pixels-per-minute))`;
        el.style.width = `calc(${duration} * var(--pixels-per-minute))`;
        el.style.top = `${activity.trackIndex * (80 + 16)}px`; // 80 is trackHeight, 16 is trackGap

        let bgColor = activity.color || '#5865F2';
        el.style.backgroundColor = hexToRgba(bgColor, 0.15);
        el.style.borderLeft = `4px solid ${bgColor}`;
        el.style.color = 'var(--text-primary)';


        el.addEventListener('click', (e) => {
            e.stopPropagation();
            renderDetails(activity);
        });

        container.appendChild(el);
    });
}

function hexToRgba(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

function setupCurrentTimeIndicator() {
    const indicator = document.getElementById('current-time-indicator');

    function update() {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        indicator.style.left = `calc(${minutes} * var(--pixels-per-minute))`;
        requestAnimationFrame(update);
    }
    update();
}

function scrollToInitialTime() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const scrollArea = document.querySelector('.timeline-container');

    // Calculate position based on current zoom
    const pixelsPerMinute = (200 * currentZoom) / 60;
    const targetX = minutes * pixelsPerMinute - (window.innerWidth / 2);
    scrollArea.scrollLeft = Math.max(0, targetX);
}

// Start
init();
