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

            <div className="s-hero">
                <div className="s-hero-badge">
                    <span>🏛️</span> Manipal Institute of Technology
                </div>
                <h1>MIT Hostel<br />Allotment Portal</h1>
                <p>A transparent, merit-based hostel room allocation system. Form your group, set your preferences, and track your allotment — all in one place.</p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <a href="/student/login" className="s-btn s-btn-primary s-btn-lg">
                        🚀 Get Started — Login / Register
                    </a>
                    <a href="/student/blocks" className="s-btn s-btn-outline s-btn-lg">
                        🏢 Browse Blocks
                    </a>
                </div>

                {stats && (
                    <div className="s-hero-grid">
                        <div className="s-hero-stat">
                            <h3>{stats.blocks}</h3>
                            <p>Hostel Blocks</p>
                        </div>
                        <div className="s-hero-stat">
                            <h3>{stats.beds.toLocaleString()}</h3>
                            <p>Total Beds</p>
                        </div>
                        <div className="s-hero-stat">
                            <h3>{stats.boys}B / {stats.girls}G</h3>
                            <p>Boys / Girls</p>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ padding: '80px 24px', maxWidth: '900px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: '28px', fontWeight: 700, marginBottom: '40px' }}>How it works</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    {[
                        { icon: '📋', step: '01', title: 'Register', desc: 'Log in using your Registration Number and set your password.' },
                        { icon: '👥', step: '02', title: 'Form a Group', desc: 'Apply solo or create a group with up to 2 friends using an invite code.' },
                        { icon: '🎯', step: '03', title: 'Set Preferences', desc: 'Your group leader chooses Pref 1 and Pref 2 — block and room type.' },
                        { icon: '🏠', step: '04', title: 'Get Allotted', desc: 'The engine runs after the deadline. Your result appears here instantly.' },
                    ].map(item => (
                        <div key={item.step} className="s-card" style={{ padding: '24px' }}>
                            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
                            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--s-teal)', letterSpacing: '0.1em', marginBottom: '6px' }}>STEP {item.step}</div>
                            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{item.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--s-text-muted)' }}>{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
