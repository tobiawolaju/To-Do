import { useState, useCallback } from 'react';

export function useConversation(user, getFreshAccessToken) {
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [pendingActivities, setPendingActivities] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://if-then.onrender.com';

    const sendMessage = useCallback(async (message) => {
        if (!user || !message.trim()) return;

        // Add user message to UI immediately
        setMessages(prev => [...prev, { content: message, isUser: true }]);
        setIsOpen(true);
        setIsTyping(true);

        try {
            const freshToken = await getFreshAccessToken();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const response = await fetch(`${API_BASE_URL}/api/chat/conversation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    userId: user.uid,
                    accessToken: freshToken,
                    timeZone
                })
            });

            const result = await response.json();
            console.log("Conversation response:", result);

            // Add assistant response
            setMessages(prev => [...prev, { content: result.message, isUser: false }]);

            // Handle proposal
            if (result.type === 'proposal' && result.activities) {
                setPendingActivities(result.activities);
            } else {
                setPendingActivities(null);
            }

        } catch (error) {
            console.error("Conversation error:", error);
            setMessages(prev => [...prev, {
                content: "Sorry, I had trouble processing that. Please try again.",
                isUser: false
            }]);
        } finally {
            setIsTyping(false);
        }
    }, [user, getFreshAccessToken, API_BASE_URL]);

    const confirmActivities = useCallback(async () => {
        if (!user || !pendingActivities) return false;

        setIsTyping(true);

        try {
            const freshToken = await getFreshAccessToken();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const response = await fetch(`${API_BASE_URL}/api/chat/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: pendingActivities,
                    userId: user.uid,
                    accessToken: freshToken,
                    timeZone
                })
            });

            const result = await response.json();
            console.log("Confirm result:", result);

            if (result.success) {
                // Add confirmation message
                setMessages(prev => [...prev, {
                    content: `✅ ${result.message}`,
                    isUser: false
                }]);
                setPendingActivities(null);

                // Close overlay after short delay
                setTimeout(() => {
                    setIsOpen(false);
                    setMessages([]);
                }, 2000);

                return true;
            } else {
                setMessages(prev => [...prev, {
                    content: "Failed to add some activities. Please try again.",
                    isUser: false
                }]);
                return false;
            }

        } catch (error) {
            console.error("Confirm error:", error);
            setMessages(prev => [...prev, {
                content: "Failed to confirm activities. Please try again.",
                isUser: false
            }]);
            return false;
        } finally {
            setIsTyping(false);
        }
    }, [user, pendingActivities, getFreshAccessToken, API_BASE_URL]);

    const rejectActivities = useCallback(() => {
        setPendingActivities(null);
        setMessages(prev => [...prev, {
            content: "No problem! Let me know if you'd like to adjust the plan.",
            isUser: false
        }]);
    }, []);

    const clearConversation = useCallback(async () => {
        if (!user) return;

        try {
            await fetch(`${API_BASE_URL}/api/chat/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid })
            });
        } catch (error) {
            console.error("Clear error:", error);
        }

        setMessages([]);
        setPendingActivities(null);
    }, [user, API_BASE_URL]);

    const closeOverlay = useCallback(() => {
        setIsOpen(false);
    }, []);

    const openOverlay = useCallback(() => {
        setIsOpen(true);
    }, []);

    return {
        messages,
        isTyping,
        isOpen,
        pendingActivities,
        sendMessage,
        confirmActivities,
        rejectActivities,
        clearConversation,
        closeOverlay,
        openOverlay
    };
}
