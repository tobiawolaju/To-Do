import React, { useEffect, useRef, useState } from 'react';
import './LandingPage.css';

// Neon Nebulas
function NeonOrbs() {
    return (
        <div className="floating-orbs" style={{ display: 'block' }}>
            <div className="orb orb-1" style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                animationDuration: '10s'
            }} />
            <div className="orb orb-2" style={{
                background: 'radial-gradient(circle, rgba(200,200,200,0.05) 0%, transparent 70%)',
                animationDuration: '15s'
            }} />
        </div>
    );
}

// Block Timestamp
function BlockClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const format = (n) => n.toString().padStart(2, '0');

    return (
        <div className="live-clock fade-in-up" style={{
            animationDelay: '0.4s',
            fontFamily: "'JetBrains Mono', monospace",
            background: 'var(--bg-glass)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            textShadow: '0 0 10px rgba(255,255,255,0.2)',
            marginTop: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>CURRENT TIME:</span>
            <span>{format(time.getHours())}:{format(time.getMinutes())}:{format(time.getSeconds())}</span>
        </div>
    );
}

export default function LandingPage({ onLogin }) {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const heroRef = useRef(null);

    // Parallax
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (heroRef.current) {
                const rect = heroRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
                const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
                setMousePosition({ x, y });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="landing-page">
            {/* Removed NeonOrbs for cleaner grid look */}

            <div className="landing-scroll-container">
                <section className="landing-section" ref={heroRef}>
                    <div
                        className="hero-content"
                        style={{
                            transform: `translate(${mousePosition.x * -15}px, ${mousePosition.y * -15}px)`
                        }}
                    >
                        <div className="hero-badge fade-in-up" style={{ borderRadius: '0px' }}>
                            <span className="badge-dot" style={{ background: 'var(--text-primary)', boxShadow: 'none', borderRadius: '0px' }}></span>
                            <span>TIME EDITOR v1.0</span>
                        </div>

                        <h1 className="brand-title fade-in-up" style={{ animationDelay: '0.1s' }}>
                            CRASTINAT
                        </h1>

                        <p className="brand-tagline fade-in-up" style={{
                            animationDelay: '0.2s',
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: '18px',
                            color: 'var(--text-secondary)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            STOP DELAYING. START LIVING.
                        </p>

                        <BlockClock />
                    </div>

                    {/* CTA Section */}
                    <div className="fade-in-up" style={{ position: 'absolute', bottom: '15vh', width: '100%', textAlign: 'center', animationDelay: '0.5s', zIndex: 10 }}>
                        <button
                            className="hero-cta"
                            onClick={onLogin}
                            style={{
                                background: 'var(--text-primary)',
                                color: 'var(--bg-void)',
                                padding: '16px 48px',
                                borderRadius: '0px',
                                fontWeight: 700,
                                fontSize: '16px',
                                letterSpacing: '0.1em',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: 'none',
                                textTransform: 'uppercase'
                            }}
                        >
                            LOGIN
                        </button>

                        <div className="trust-badges" style={{ marginTop: '32px', opacity: 0.7 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Focus First</span>
                            <span style={{ margin: '0 12px', color: 'var(--text-muted)' }}>//</span>
                            <span style={{ color: 'var(--text-secondary)' }}>Real Intent</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
