import React, { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import './FuturesNotification.css';

export default function FuturesNotification({ userId, onViewFutures, apiBaseUrl }) {
    const [isStale, setIsStale] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const checkStatus = async () => {
            try {
                const res = await fetch(`${apiBaseUrl}/api/check-futures-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const data = await res.json();
                if (data.isStale) {
                    setIsStale(true);
                    setDismissed(false);
                }
            } catch (err) {
                console.error("Failed to check futures status:", err);
            }
        };

        // Check on mount and every 30 seconds
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [userId, apiBaseUrl]);

    const handleDismiss = () => {
        setDismissed(true);
    };

    const handleView = () => {
        setDismissed(true);
        onViewFutures();
    };

    if (!isStale || dismissed) return null;

    return (
        <div className="futures-fab">
            <div className="fab-icon">
                <Sparkles size={24} />
            </div>
            <div className="fab-content">
                <span className="fab-title">Updates made to your future</span>
                <div className="fab-actions">
                    <button className="fab-action view" onClick={handleView}>
                        View now <ArrowRight size={16} />
                    </button>
                    <button className="fab-action dismiss" onClick={handleDismiss}>
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
