import React, { useEffect, useRef, useState } from 'react';

// Neon Nebulas
function NeonOrbs() {
    return (
        <div className="floating-orbs" style={{ display: 'block' }}>
            <div className="orb orb-1" style={{
                background: 'radial-gradient(circle, rgba(112,0,255,0.4) 0%, transparent 70%)',
                animationDuration: '10s'
            }} />
            <div className="orb orb-2" style={{
                background: 'radial-gradient(circle, rgba(0,240,255,0.3) 0%, transparent 70%)',
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
            border: '1px solid var(--accent-primary)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            textShadow: '0 0 10px var(--accent-primary)',
            marginTop: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            <span style={{ color: 'var(--accent-secondary)', fontSize: '0.8em' }}>BLOCK_TIME:</span>
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
            <NeonOrbs />

            <div className="landing-scroll-container">
                <section className="landing-section" ref={heroRef}>
                    <div
                        className="hero-content"
                        style={{
                            transform: `translate(${mousePosition.x * -15}px, ${mousePosition.y * -15}px)`
                        }}
                    >
                        <div className="hero-badge fade-in-up">
                            <span className="badge-dot" style={{ background: '#00ff9d', boxShadow: '0 0 10px #00ff9d' }}></span>
                            <span>PROTOCOL V2.0</span>
                        </div>

                        <h1 className="brand-title fade-in-up" style={{ animationDelay: '0.1s' }}>
                            CRASTINAT
                        </h1>

                        <p className="brand-tagline fade-in-up" style={{
                            animationDelay: '0.2s',
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: '18px',
                            color: 'var(--text-secondary)',
                            letterSpacing: '0.05em'
                        }}>
                            THE DECENTRALIZED TIME LAYER.
                        </p>

                        <BlockClock />
                    </div>

                    {/* CTA Section */}
                    <div className="fade-in-up" style={{ position: 'absolute', bottom: '15vh', width: '100%', textAlign: 'center', animationDelay: '0.5s', zIndex: 10 }}>
                        <button
                            className="hero-cta"
                            onClick={onLogin}
                            style={{
                                background: 'linear-gradient(90deg, #7000ff, #00f0ff)',
                                color: '#fff',
                                padding: '16px 48px',
                                borderRadius: '30px',
                                fontWeight: 700,
                                fontSize: '16px',
                                letterSpacing: '0.1em',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 0 30px rgba(112, 0, 255, 0.5)',
                                textTransform: 'uppercase'
                            }}
                        >
                            Connect Identity
                        </button>

                        <div className="trust-badges" style={{ marginTop: '32px', opacity: 0.7 }}>
                            <span style={{ color: 'var(--accent-secondary)' }}>zk-Sync Ready</span>
                            <span style={{ margin: '0 12px', color: '#555' }}>//</span>
                            <span style={{ color: 'var(--accent-secondary)' }}>Zero Latency</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
