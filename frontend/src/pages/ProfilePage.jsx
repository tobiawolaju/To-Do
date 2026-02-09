import React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage({ user, onLogout, onBack }) {




    return (
        <div className="app-container">
            <header>
                <div className="header-main">
                    <button
                        className="icon-btn"
                        onClick={onBack}
                        aria-label="Go back"
                        style={{ marginRight: '12px' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1>{user?.displayName || 'Profile'}</h1>
                </div>
                <div id="auth-container">
                    <button
                        className="action-button secondary"
                        onClick={onLogout}
                        style={{ padding: '8px 20px' }}
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </header>

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '48px 24px',
                textAlign: 'center',
                overflowY: 'auto',
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto'
            }}>
                <img
                    src={user?.photoURL}
                    alt={user?.displayName || 'User'}
                    style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '0px',
                        border: '1px solid var(--border-visible)',
                        marginBottom: '24px',
                        boxShadow: 'none'
                    }}
                />
                <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.75rem',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: 'var(--text-primary)'
                }}>
                    {user?.displayName || 'User'}
                </h2>
                <p style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    marginBottom: '48px'
                }}>
                    {user?.email}
                </p>

                {/* About Section */}
                <div style={{ width: '100%', textAlign: 'left', marginTop: '24px' }}>
                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '12px'
                    }}>
                        About IF·THEN
                    </h3>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
                        IF·THEN is a personal consequence simulator designed to help you visualize the long-term impact of your daily decisions.
                        Unlike a traditional to-do list, it focuses on time continuity, habit compounding, and future simulation.
                    </p>

                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        marginBottom: '12px'
                    }}>
                        How to Use
                    </h3>
                    <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold' }}>1</span>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Chat Naturally</strong>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Just tell the AI what you want to do. "Gym at 5pm", "Read for 30 mins", or even "Help me plan my morning".
                                </p>
                            </div>
                        </li>
                        <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold' }}>2</span>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Predict Your Future</strong>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Click the Crystal Ball (✨) in the chat bar to see 3 possible future paths based on your current habits and schedule.
                                </p>
                            </div>
                        </li>
                        <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: '#f59e0b',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontWeight: 'bold' }}>3</span>
                            </div>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Real-time Sync</strong>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Your activities automatically sync with Google Calendar, so you're always up to date across all your devices.
                                </p>
                            </div>
                        </li>
                    </ul>
                </div>
            </main>
        </div>
    );
}

