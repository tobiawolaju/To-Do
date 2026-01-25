# To-Do Timeline App with AI & Google Calendar Integration

A smart daily planner application that uses AI to manage your schedule, syncs with Google Calendar, and persists data using Firebase Realtime Database.

## Architecture

```mermaid
graph TD
    subgraph Client [Frontend (Vite)]
        UI[User Interface]
        AuthSDK[Firebase Auth SDK]
        DBSDK[Firebase Realtime DB SDK]
    end

    subgraph Server [Backend (Node/Express)]
        API[API Endpoint /api/chat]
        Gemini[Gemini AI Client]
        Tools[Tool Definitions]
        FBAdmin[Firebase Admin SDK]
    end

    subgraph Cloud [Google Cloud & Firebase]
        FirebaseAuth[Firebase Authentication]
        RTDB[(Realtime Database)]
        GeminiAPI[Gemini Pro API]
        GCalAPI[Google Calendar API]
    end

    %% User Interaction
    User((User)) -->|Interacts| UI
    UI -->|Google Sign-In| AuthSDK
    AuthSDK -->|Verify Creds| FirebaseAuth
    
    %% Realtime Data Sync
    UI -->|Listen for Changes| DBSDK
    DBSDK <-->|Sync Schedule| RTDB

    %% Chat & AI Flow
    UI -->|Send Command + Tokens| API
    API -->|Verify ID Token| FBAdmin
    FBAdmin -->|Check Token| FirebaseAuth
    
    API -->|Prompt| Gemini
    Gemini -->|Process| GeminiAPI
    GeminiAPI -->|Function Call| Tools
    
    %% Tool Execution
    Tools -->|Read/Write| RTDB
    Tools -->|Sync Events| GCalAPI
    
    %% Response
    Tools -->|Result| API
    API -->|AI Reply| UI
```

## Features

-   **Timeline Visualization**: Horizontal scrolling timeline for daily activities.
-   **AI Assistant**: Chat with Gemini to add, update, or remove events using natural language (e.g., "Schedule lunch at 12pm").
-   **Google Calendar Sync**: Events added via the app appear in your Google Calendar and vice versa.
-   **Realtime Updates**: Changes reflect instantly across devices using Firebase.
-   **Secure Authentication**: Google Sign-In via Firebase Auth.

## Setup Instructions

### Prerequisites
- Node.js installed
- Google Cloud Project with Calendar API enabled
- Firebase Project with Auth & Realtime Database enabled

### Installation

1.  **Clone the repository**
2.  **Backend Setup**:
    ```bash
    cd backend
    npm install
    ```
    - Create `.env` with `GEMINI_API_KEY`.
    - Place `serviceAccountKey.json` (from Firebase) in `backend/`.
    - Run: `node server.js`
3.  **Frontend Setup**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    - Configure `firebaseConfig` in `script.js`.
4.  Open the local URL (e.g., `http://localhost:5173`).
