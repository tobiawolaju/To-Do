import React, { useState } from 'react';
import Header from '../components/Header';
import Timeline from '../components/Timeline';
import ChatInput from '../components/ChatInput';
import DetailsSheet from '../components/DetailsSheet';
import { useSchedule } from '../hooks/useSchedule';
import { database } from '../firebase-config';
import { ref, update, remove } from 'firebase/database';

export default function Dashboard({ user, onLogout, accessToken, onNavigateToProfile }) {
    const { activities, loading: scheduleLoading } = useSchedule(user?.uid);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSendMessage = async (message) => {
        setIsProcessing(true);
        try {
            const response = await fetch('https://to-do-iun8.onrender.com/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, userId: user.uid, accessToken })
            });
            const result = await response.json();
            console.log("AI Response:", result);
        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveActivity = async (updatedActivity) => {
        if (!user) return;

        try {
            const response = await fetch('https://to-do-iun8.onrender.com/api/activities/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: updatedActivity.id,
                    updates: updatedActivity,
                    userId: user.uid,
                    accessToken
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to update activity");
            }

            return true;
        } catch (error) {
            console.error("Save error:", error);
            throw error;
        }
    };

    const handleDeleteActivity = async (activityId) => {
        if (!user || !window.confirm("Are you sure?")) return;

        try {
            await fetch('https://to-do-iun8.onrender.com/api/activities/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activityId,
                    userId: user.uid,
                    accessToken
                })
            });
        } catch (error) {
            console.error("Delete error:", error);
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
            <ChatInput onSendMessage={handleSendMessage} isProcessing={isProcessing} />
        </div>
    );
}
