'use client';

import { useEffect, useState } from 'react';

export default function StudentLandingPage() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        // Try to load some public stats (blocks count, total beds)
        fetch('/api/student/blocks')
            .then(r => r.json())
            .then(d => {
                const blocks = d.blocks || [];
                setStats({
                    blocks: blocks.length,
                    beds: blocks.reduce((s, b) => s + b.totalBeds, 0),
                    boys: blocks.filter(b => b.gender === 'MALE').length,
                    girls: blocks.filter(b => b.gender === 'FEMALE').length,
                });
            })
            .catch(() => { });
    }, []);

    return (
        <>
            <nav className="s-nav">
                <a href="/student" className="s-nav-brand">🏛️ MIT <span>Hostel Portal</span></a>
                <div className="s-nav-links">
                    <a href="/student/blocks" className="s-nav-link">🏢 Campus Blocks</a>
                    <a href="/student/login" className="s-btn s-btn-primary" style={{ padding: '8px 20px', fontSize: '14px' }}>Login / Register →</a>
                </div>
            </nav>

            <div className="s-hero" style={{ position: 'relative', zIndex: 1 }}>
                <div className="s-hero-badge" style={{ animation: 's-fadeUp 0.6s ease both' }}>
                    <span>🏛️</span> Manipal Institute of Technology
                </div>
                <h1 style={{ animation: 's-fadeUp 0.6s ease 0.1s both', background: 'linear-gradient(135deg, #FFFFFF 0%, #63d1b7 50%, #10B981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MIT Hostel<br />Allotment Portal</h1>
                <p style={{ animation: 's-fadeUp 0.6s ease 0.2s both', fontSize: '18px', maxWidth: '600px', lineHeight: 1.7, color: 'var(--s-text-secondary)' }}>A perfectly transparent, merit-based hostel allocation system. Join forces with your friends, establish your priorities, and track your allotment instantly.</p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px', animation: 's-fadeUp 0.6s ease 0.3s both' }}>
                    <a href="/student/login" className="s-btn s-btn-primary s-btn-lg" style={{ padding: '16px 36px', fontSize: '16px', boxShadow: '0 8px 32px rgba(99,209,183,0.4)', borderRadius: '100px' }}>
                        🚀 Get Started — Portal Login
                    </a>
                    <a href="/student/blocks" className="s-btn s-btn-outline s-btn-lg" style={{ padding: '16px 36px', fontSize: '16px', borderRadius: '100px', backdropFilter: 'blur(12px)' }}>
                        🏢 Browse Campus
                    </a>
                </div>

                {stats && (
                    <div className="s-hero-grid" style={{ animation: 's-fadeUp 0.6s ease 0.4s both', marginTop: '64px' }}>
                        <div className="s-hero-stat" style={{ background: 'linear-gradient(135deg, rgba(26, 34, 52, 0.6) 0%, rgba(10, 15, 26, 0.8) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                            <h3 style={{ background: 'linear-gradient(135deg, var(--s-teal) 0%, var(--s-green) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stats.blocks}</h3>
                            <p style={{ fontWeight: 600, color: 'var(--s-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>Hostel Blocks</p>
                        </div>
                        <div className="s-hero-stat" style={{ background: 'linear-gradient(135deg, rgba(26, 34, 52, 0.6) 0%, rgba(10, 15, 26, 0.8) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                            <h3 style={{ background: 'linear-gradient(135deg, var(--s-teal) 0%, var(--s-green) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stats.beds.toLocaleString()}</h3>
                            <p style={{ fontWeight: 600, color: 'var(--s-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>Total Beds</p>
                        </div>
                        <div className="s-hero-stat" style={{ background: 'linear-gradient(135deg, rgba(26, 34, 52, 0.6) 0%, rgba(10, 15, 26, 0.8) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px' }}>
                            <h3 style={{ background: 'linear-gradient(135deg, var(--s-teal) 0%, var(--s-green) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stats.boys}B / {stats.girls}G</h3>
                            <p style={{ fontWeight: 600, color: 'var(--s-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>Boys / Girls</p>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ padding: '80px 24px', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                <h2 style={{ textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: '32px', fontWeight: 800, marginBottom: '40px', letterSpacing: '-0.02em', color: 'var(--s-text-primary)' }}>Designed for Transparency</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
                    {[
                        { icon: '📋', step: '01', title: 'Register', desc: 'Securely log in using your Registration Number.' },
                        { icon: '👥', step: '02', title: 'Form a Group', desc: 'Invite friends seamlessly through a secure invite code.' },
                        { icon: '🎯', step: '03', title: 'Set Preferences', desc: 'Team leader defines prioritized choices for the group.' },
                        { icon: '🪐', step: '04', title: 'Get Allotted', desc: 'Algorithm guarantees a merit-based transparent allocation.' },
                    ].map(item => (
                        <div key={item.step} className="s-card" style={{ padding: '32px 24px', background: 'linear-gradient(145deg, rgba(26, 34, 52, 0.5) 0%, rgba(10, 15, 26, 0.3) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)',width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>{item.icon}</div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 800, color: 'var(--s-teal)', letterSpacing: '0.15em', marginBottom: '8px' }}>STEP {item.step}</div>
                            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: 'var(--s-text-primary)' }}>{item.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--s-text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
