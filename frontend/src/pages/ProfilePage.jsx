import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function ProfilePage({ user, onLogout, onBack }) {
    return (
        <div className="dashboard-page">
            <header>
                <div className="header-main" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="icon-btn" onClick={onBack} aria-label="Go back">
                        <ArrowLeft size={20} />
                    </button>
                    <h1>{user.displayName || 'Tobi Awolaju'}</h1>
                </div>
                <div id="auth-container">
                    <div id="user-profile">
                        <img id="user-photo" src={user.photoURL} alt="User" />
                        <button className="icon-btn" onClick={onLogout} aria-label="Sign out">
                            <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={18} />
                        </button>
                    </div>
                </div>
            </header>
        </div>
    );
}
