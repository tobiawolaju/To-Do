# Project Description: IF·THEN 

## 1. Project Overview
**IF·THEN** (formerly Crastinat) is a "personal consequence simulator" designed to help users visualize the long-term impact of their daily decisions. Unlike a traditional to-do list, it focuses on time continuity, habit compounding, and future simulation.

The application allows users to:
1.  **Visualize Time**: View a horizontal, continuous timeline of their day.
2.  **Interact Naturally**: Use AI-powered chat to schedule tasks, build routines, and manage time using natural language.
3.  **Simulate Futures**: Generate three distinct future scenarios (Baseline, Optimistic, Risk) based on their current schedule and behavior patterns over a 6-month horizon.
4.  **Sync Real-time**: Bidirectional synchronization with Google Calendar and instant updates across devices via Firebase.

---

## 2. Technical Architecture

### High-Level Stack
*   **Frontend**: React (Vite), CSS3 (Variables + Flexbox/Grid), Firebase SDK (Client).
*   **Backend**: Node.js, Express, Firebase Admin SDK, Google Gemini API, Google Calendar API.
*   **Database**: Firebase Realtime Database (JSON tree structure).
*   **Authentication**: Firebase Authentication (Google Sign-In).
*   **AI Engine**: Google Gemini 2.0 Flash / Pro (via `@google/generative-ai`).

### System Diagram
```mermaid
graph TD
    User((User)) -->|Browser| Frontend[Frontend (React + Vite)]
    
    subgraph "Frontend Layer"
        Frontend -->|Auth (Google)| FirebaseAuth[Firebase Auth]
        Frontend -->|Realtime Data| RTDB[Firebase Realtime DB]
        Frontend -->|API Calls| BackendAPI[Backend API (Render)]
    end

    subgraph "Backend Layer (Node.js)"
        BackendAPI -->|Intent/Gen| Gemini[Google Gemini API]
        BackendAPI -->|Sync| GCal[Google Calendar API]
        BackendAPI -->|CRUD/Admin| RTDB_Admin[Firebase RTDB (Admin)]
    end

    RTDB <--> RTDB_Admin
```

---

## 3. Frontend Architecture (`/frontend`)

The frontend is a Single Page Application (SPA) built with React and Vite. It uses a custom-built timeline engine rather than off-the-shelf calendar libraries to support its unique "continuous time" philosophy.

### Key Components
*   **`App.jsx`**: Main entry point. Handles routing state (`view`: 'timeline' | 'profile') and authentication initialization.
*   **`Timeline.jsx`**: The core visualization component.
    *   Implements a custom horizontal scroll with physics-based zoom (lerp animation).
    *   Renders `ActivityBlock` components on dynamically calculated tracks to handle overlapping events.
    *   Uses `requestAnimationFrame` for smooth time indicator updates.
*   **`ChatOverlay.jsx` / `ChatInput.jsx`**: The command center. Users type requests here ("Book gym at 5pm"), which are sent to the backend for intent verification before confirmation.
*   **`ProfilePage.jsx`**: Displays the "Predicted Futures". Fetches generated scenarios from the backend.

### State Management & Hooks
*   **`useAuth.js`**: Manages Firebase User state and Google Access Token.
    *   *Critical*: It actively manages the Google Access Token (`googleAccessToken`) in `localStorage` to ensure the backend can make authenticated calls to Google Calendar on the user's behalf.
*   **`useSchedule.js`**: A listener hook for Firebase Realtime Database.
    *   Subscribes to `users/{uid}/schedule`.
    *   Automatically updates the UI whenever data changes (local or remote).
*   **`useConversation.js`**: Manages the optimistic UI for chat.
    *   Handles the "Proposal" flow: User Request -> AI Proposal -> User Confirm -> Write to DB.

### Configuration
*   **Vite**: Configured for fast HMR.
*   **Firebase**: Client SDK initialized in `firebase-config.js` with public API keys (standard for Firebase Client).

---

## 4. Backend Architecture (`/backend`)

The backend is a RESTful API service built with Express. It acts as the "Agent" layer, mediating between the user's data, the AI models, and external services (Google Calendar).

### Core Services (`server.js` & `tools.js`)

#### 1. AI Intent Engine
*   **Endpoint**: `/api/chat`
*   **Function**: `extractIntent(message)`
*   **Logic**: Uses Gemini to parse natural language into specific JSON commands:
    *   `addActivity`: Create new events.
    *   `updateActivity` / `deleteActivity`: Modify existing ones.
    *   `getSchedule`: Query data.
    *   `findHackathons`: specialized search (mock/demo).
*   **Handling**: If the intent is complex, the backend performs the necessary DB/Calendar operations and returns a structured result.

#### 2. Conversational Planner
*   **Endpoint**: `/api/chat/conversation`
*   **Logic**: Maintains a specialized "Life Planner" persona.
    *   Fetches the last 20 messages (`chatContext` in DB) and the user's current schedule.
    *   Feeds this context to Gemini to generate context-aware advice or schedule proposals.

#### 3. Future Predictor
*   **Endpoint**: `/api/predict-future`
*   **Logic**:
    1.  Aggregates User Schedule + Recent Chat History.
    2.  Generates a SHA-256 hash of this content to detect changes ("Staleness Check").
    3.  If data has changed (Hash Mismatch), it invokes Gemini to generate 3 scenarios:
        *   **Baseline**: Status quo.
        *   **Optimistic**: Goals met.
        *   **Risk**: Bad habits compound.
    4.  Caches the result and the hash in Firebase (`users/{uid}/futures`) to save tokens on subsequent reads.

#### 4. Synchronization Engine (`tools.js`)
*   **Bidirectional Sync**:
    *   **DB -> Calendar**: When an activity is added/updated via Chat, the backend uses the User's Access Token to push changes to Google Calendar immediately.
    *   **Calendar -> DB**: (Partial/TODO) currently emphasizes app-to-calendar sync.
*   **Recurring Events**: Converts natural language days ("Every Monday") into **RRULE** format for Google Calendar.
*   **Timezone Handling**: Manually constructs ISO strings with offsets to ensure accurate synchronization across timezones.

---

## 5. Data Model (Firebase RTDB)

The data is structured as a JSON tree under `users/{uid}`:

```json
users/
  {uid}/
    schedule/           // List of activities
      [
        {
          "id": 1,
          "title": "Deep Work",
          "startTime": "09:00",
          "endTime": "11:00",
          "days": ["Monday", "Wednesday"],
          "googleEventId": "..."   // Link to GCal
        }
      ]
    chatContext/       // Conversation history
      messages: [ ... ]
      lastUpdated: 1234567890
    futures/           // Cached predictions
      hash: "sha256..."
      data: [ ... ]
```

---

## 6. Key Workflows

### The "Add Activity" Flow
1.  **User**: Types "Gym every Mon, Wed at 6pm" in Frontend.
2.  **Frontend**: Sends text to `POST /api/chat`.
3.  **Backend (AI)**: `extractIntent` identifies:
    *   Intent: `addActivity`
    *   Days: `["Monday", "Wednesday"]`
    *   Time: `18:00`
4.  **Backend (Tool)**: `tools.addActivity` is called.
    *   Calculates next ID.
    *   **GCal**: Calls Google Calendar API to create recurring event. Receives `googleEventId`.
    *   **DB**: Saves activity object (with `googleEventId`) to Firebase.
5.  **Frontend**: Receives success. `useSchedule` hook detects DB change and re-renders Timeline automatically.

### The "Prediction" Flow
1.  **User**: Navigates to Profile.
2.  **Frontend**: Calls `POST /api/predict-future`.
3.  **Backend**:
    *   Fetches current Schedule + Chat Log.
    *   Hashes them. Checks against stored hash.
    *   **If Stale**: Sends massive prompt to Gemini -> parses JSON -> updates DB -> returns new Futures.
    *   **If Fresh**: Returns cached Futures from DB immediately.
4.  **Frontend**: Renders 3 cards (Baseline, Optimistic, Risk).

---

## 7. Deployment & Configuration

*   **Environment Variables**:
    *   `GEMINI_API_KEY`: For AI generation.
    *   `firebase-service-account.json`: For Backend Admin access.
    *   `RENDER`: Detected to switch credential loading paths.
*   **Endpoints**:
    *   Production: `https://if-then.onrender.com`
    *   Local: `http://localhost:3000`
*   **Package Dependencies**:
    *   Backend: `@google/generative-ai`, `firebase-admin`, `googleapis`.
    *   Frontend: `firebase`, `lucide-react`, `vite`.
