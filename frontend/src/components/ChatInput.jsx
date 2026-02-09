import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import './ChatInput.css';

export default function ChatInput({ onSendMessage, isProcessing, onOpenFutures }) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [message]);

    const handleSubmit = () => {
        if (message.trim() && !isProcessing) {
            onSendMessage(message);
            setMessage('');
        }
    };

    return (
        <div className="chat-input-container" style={{ borderRadius: '0px', boxShadow: 'none' }}>
            <textarea
                ref={textareaRef}
                id="chat-input"
                rows="1"
                placeholder={isProcessing ? "Planning your time..." : "Schedule something..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isProcessing}
                style={{ borderRadius: '0px' }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                    }
                }}
            />
            <button
                className={`action-btn ${!message.trim() && !isProcessing ? 'futures-trigger' : ''}`}
                onClick={() => {
                    if (!message.trim() && !isProcessing) {
                        onOpenFutures?.();
                    } else {
                        handleSubmit();
                    }
                }}
                disabled={isProcessing}
                aria-label={message.trim() ? "Send message" : "Predict Future"}
                style={{ borderRadius: '0px', boxShadow: 'none' }}
                title={!message.trim() ? "See your predicted future" : "Send"}
            >
                {isProcessing ? (
                    <Sparkles size={18} className="animate-pulse" />
                ) : message.trim() ? (
                    <Send size={18} />
                ) : (
                    <Sparkles size={18} />
                )}
            </button>
        </div>
    );
}
