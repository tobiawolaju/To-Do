import React, { useState } from 'react';
import Header from '../components/Header';
import Timeline from '../components/Timeline';
import ChatInput from '../components/ChatInput';
import ChatOverlay from '../components/ChatOverlay';
import DetailsSheet from '../components/DetailsSheet';
import FuturesNotification from '../components/FuturesNotification';
import FuturesModal from '../components/FuturesModal';
import { useSchedule } from '../hooks/useSchedule';
import { useConversation } from '../hooks/useConversation';
import './Dashboard.css';

export default function Dashboard({ user, onLogout, accessToken, getFreshAccessToken, onNavigateToProfile }) {
    const { activities, loading: scheduleLoading } = useSchedule(user?.uid);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showFuturesModal, setShowFuturesModal] = useState(false);

    // Conversation state
    const conversation = useConversation(user, getFreshAccessToken);

    // Dynamic API URL for local vs production testing
    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://if-then.onrender.com';

    const handleSendMessage = async (message) => {
        // Use the new conversation system
        await conversation.sendMessage(message);
    };

    const handleConfirmActivities = async () => {
        const success = await conversation.confirmActivities();
        // Firebase real-time updates will automatically refresh the schedule
    };

    const handleSaveActivity = async (updatedActivity) => {
        if (!user) return;
        console.log(`Flow: Saving activity update to ${API_BASE_URL}/api/activities/update`);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        try {
            const freshToken = await getFreshAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/activities/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: updatedActivity.id,
                    updates: updatedActivity,
                    userId: user.uid,
                    accessToken: freshToken,
                    timeZone
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to update activity");
            }

            const result = await response.json();
            console.log("Flow: Save result:", result);
            return true;
        } catch (error) {
            console.error("Flow: Save error:", error);
            throw error;
        }
    };

    const handleDeleteActivity = async (activityId) => {
        if (!user || !window.confirm("Are you sure?")) return;
        console.log(`Flow: Deleting activity via ${API_BASE_URL}/api/activities/delete`);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        try {
            const freshToken = await getFreshAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/activities/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activityId,
                    userId: user.uid,
                    accessToken: freshToken,
                    timeZone
                })
            });
            const result = await response.json();
            console.log("Flow: Delete result:", result);
        } catch (error) {
            console.error("Flow: Delete error:", error);
        }

        setSelectedActivity(null);
    };

    if (scheduleLoading) return <div className="loading">Loading Schedule...</div>;

    return (
        <div className="app-container">
            <Header user={user} onLogout={onLogout} onProfileClick={onNavigateToProfile} />
            <main className={`main-content ${selectedActivity ? 'has-selection' : ''}`}>
                <Timeline
                    activities={activities}
                    onSelectActivity={setSelectedActivity}
                />
                <DetailsSheet
                    activity={selectedActivity}
                    isOpen={!!selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                    onSave={handleSaveActivity}
                    onDelete={handleDeleteActivity}
                />
            </main>

            <ChatOverlay
                isOpen={conversation.isOpen}
                messages={conversation.messages}
                isTyping={conversation.isTyping}
                pendingActivities={conversation.pendingActivities}
                onClose={conversation.closeOverlay}
                onConfirm={handleConfirmActivities}
                onReject={conversation.rejectActivities}
                onClear={conversation.clearConversation}
            />

            <ChatInput
                onSendMessage={handleSendMessage}
                isProcessing={conversation.isTyping}
                onOpenFutures={() => setShowFuturesModal(true)}
            />

            <FuturesNotification
                userId={user?.uid}
                apiBaseUrl={API_BASE_URL}
                onViewFutures={() => setShowFuturesModal(true)}
            />

            {showFuturesModal && (
                <FuturesModal
                    user={user}
                    onClose={() => setShowFuturesModal(false)}
                    apiBaseUrl={API_BASE_URL}
                />
            )}
        </div>
    );
}
