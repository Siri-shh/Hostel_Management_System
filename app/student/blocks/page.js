'use client';

import { useState, useEffect } from 'react';

export default function CampusBlocksPage() {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterGender, setFilterGender] = useState('ALL');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/student/blocks')
            .then(r => r.json())
            .then(d => { setBlocks(d.blocks || []); setLoading(false); })
            .catch(() => { setError('Failed to load block data.'); setLoading(false); });
    }, []);

    const filtered = blocks
        .filter(b => filterGender === 'ALL' || b.gender === filterGender)
        .filter(b => search === '' || b.number.toString().includes(search));

    const totalBeds = filtered.reduce((s, b) => s + b.totalBeds, 0);
    const totalRooms = filtered.reduce((s, b) => s + b.totalRooms, 0);
    const boysBlocks = blocks.filter(b => b.gender === 'MALE').length;
    const girlsBlocks = blocks.filter(b => b.gender === 'FEMALE').length;

    return (
        <div className="s-page">
            <nav className="s-nav">
                <a href="/student" className="s-nav-brand">🏛️ MIT <span>Hostel Portal</span></a>
                <div className="s-nav-links">
                    <a href="/student/dashboard" className="s-nav-link">← My Dashboard</a>
                </div>
            </nav>

            <div className="s-container s-animate-in">
                <div className="s-page-header">
                    <h1>🏢 Campus Hostel Blocks</h1>
                    <p>Browse all hostel blocks, room types, and capacity information to help choose your preferences.</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '80px' }}><span className="s-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
                ) : error ? (
                    <div className="s-alert s-alert-error">{error}</div>
                ) : (
                    <>
                        {/* Summary stats */}
                        <div className="s-stats-row">
                            <div className="s-stat">
                                <div className="s-stat-value">{blocks.length}</div>
                                <div className="s-stat-label">Total Blocks</div>
                            </div>
                            <div className="s-stat">
                                <div className="s-stat-value">{boysBlocks}</div>
                                <div className="s-stat-label">Boys Blocks</div>
                            </div>
                            <div className="s-stat">
                                <div className="s-stat-value">{girlsBlocks}</div>
                                <div className="s-stat-label">Girls Blocks</div>
                            </div>
                            <div className="s-stat">
                                <div className="s-stat-value">{blocks.reduce((s, b) => s + b.totalBeds, 0).toLocaleString()}</div>
                                <div className="s-stat-label">Total Beds</div>
                            </div>
                        </div>

                        {/* Filter bar */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <input
                                className="s-input"
                                style={{ flex: 1, maxWidth: '200px' }}
                                placeholder="Search block number..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {['ALL', 'MALE', 'FEMALE'].map(g => (
                                <button
                                    key={g}
                                    className="s-btn"
                                    onClick={() => setFilterGender(g)}
                                    style={{
                                        background: filterGender === g ? 'var(--s-teal)' : 'rgba(255,255,255,0.05)',
                                        color: filterGender === g ? '#0a0f1a' : 'var(--s-text-muted)',
                                        border: filterGender === g ? 'none' : '1px solid var(--s-border)',
                                        fontWeight: 700,
                                    }}
                                >
                                    {g === 'ALL' ? '🏘️ All' : g === 'MALE' ? '👦 Boys Only' : '👧 Girls Only'}
                                </button>
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="s-card" style={{ textAlign: 'center', padding: '48px' }}>
                                <p style={{ color: 'var(--s-text-muted)' }}>No blocks match your filter.</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                            {filtered.map(block => (
                                <div key={block.id} className="s-block-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <div className="s-block-num">{block.number}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--s-text-muted)' }}>Block {block.number} · {block.floors} Floors</div>
                                        </div>
                                        <span className={`s-badge ${block.gender === 'MALE' ? 's-badge-blue' : 's-badge-teal'}`}>
                                            {block.gender === 'MALE' ? '👦 Boys' : '👧 Girls'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                                        <div className="s-stat" style={{ padding: '10px 12px' }}>
                                            <div className="s-stat-value" style={{ fontSize: '18px' }}>{block.totalRooms}</div>
                                            <div className="s-stat-label">Rooms</div>
                                        </div>
                                        <div className="s-stat" style={{ padding: '10px 12px' }}>
                                            <div className="s-stat-value" style={{ fontSize: '18px' }}>{block.totalBeds}</div>
                                            <div className="s-stat-label">Beds</div>
                                        </div>
                                    </div>

                                    {block.roomTypeBreakdown.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--s-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Room Types</div>
                                            <div className="s-table-wrap">
                                                <table className="s-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Type</th>
                                                            <th>Capacity</th>
                                                            <th>Rooms</th>
                                                            <th>Beds</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {block.roomTypeBreakdown.map(rt => (
                                                            <tr key={rt.code}>
                                                                <td><span className="s-badge s-badge-gray" style={{ fontSize: '11px' }}>{rt.code}</span></td>
                                                                <td>× {rt.capacity}</td>
                                                                <td>{rt.totalRooms}</td>
                                                                <td style={{ color: 'var(--s-teal)', fontWeight: 600 }}>{rt.totalBeds}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
