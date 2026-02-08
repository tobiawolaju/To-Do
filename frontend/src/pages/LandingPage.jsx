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


                        <h1 className="brand-title fade-in-up" style={{ animationDelay: '0.1s' }}>
                            CRASTINAT
                        </h1>


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


                    </div>
                </section>
            </div>
        </div>
    );
}
