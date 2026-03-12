'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

export default function ResultsPage({ params }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBlock, setSelectedBlock] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/results/${params.sessionId}`);
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [params.sessionId]);

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header"><div><h1>Results</h1></div></div>
                <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="animate-in">
                <div className="page-header"><div><h1>Results</h1></div></div>
                <div className="empty-state"><h3>Session not found</h3></div>
            </div>
        );
    }

    const filteredAllotted = stats.allottedList?.filter(s =>
        !searchTerm ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.regNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.department.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    // Chart data
    const blockChartData = stats.blockStats?.map(b => ({
        name: `Blk ${b.blockNumber}`,
        allotted: b.allotted,
        capacity: b.totalBeds,
        avgCgpa: b.avgCgpa,
    })) || [];

    const roomTypeChartData = stats.roomTypeStats?.map(rt => ({
        name: rt.code,
        count: rt.count,
    })) || [];

    const genderData = stats.genderStats ? [
        { name: 'Male', value: stats.genderStats.MALE || 0 },
        { name: 'Female', value: stats.genderStats.FEMALE || 0 },
    ] : [];

    const yearData = stats.yearStats ? Object.entries(stats.yearStats).map(([yr, count]) => ({
        name: `Year ${yr}`,
        count,
    })) : [];

    // Block room data for preview
    const blockRoomList = selectedBlock && stats.blockRoomData?.[selectedBlock]
        ? stats.blockRoomData[selectedBlock] : [];

    function downloadCSV() {
        if (!stats.allottedList) return;
        const headers = ['Reg No', 'Name', 'Gender', 'Year', 'Department', 'CGPA', 'Block', 'Room', 'Room Type', 'Round'];
        const rows = stats.allottedList.map(s => [
            s.regNo, s.name, s.gender, s.year, s.department, s.cgpa, s.block, s.roomNumber, s.roomType, s.round,
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        triggerDownload(csv, `allotment_results_session_${params.sessionId}.csv`);
    }

    function downloadBlockCSV(blockNum) {
        const rooms = stats.blockRoomData?.[blockNum];
        if (!rooms) return;
        const headers = ['Room Number', 'Floor', 'Room Type', 'Capacity', 'Reg No', 'Name', 'Gender', 'Year', 'Department', 'CGPA', 'Round'];
        const rows = [];
        for (const room of rooms) {
            for (const occ of room.occupants) {
                rows.push([
                    room.roomNumber, room.floor, room.roomType, room.capacity,
                    occ.regNo, occ.name, occ.gender, occ.year, occ.department, occ.cgpa, occ.round,
                ]);
            }
        }
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        triggerDownload(csv, `block_${blockNum}_rooms_session_${params.sessionId}.csv`);
    }

    function triggerDownload(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Allotment Results</h1>
                    <p>Session #{params.sessionId} — {stats.session?.name || ''}</p>
                </div>
                <button className="btn btn-outline" onClick={downloadCSV}>📥 Export All CSV</button>
            </div>

            {/* Overview Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div className="stat-info"><h3>{stats.allotted}</h3><p>Allotted</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow">⏳</div>
                    <div className="stat-info"><h3>{stats.waitlisted}</h3><p>Waitlisted</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon red">🚫</div>
                    <div className="stat-info"><h3>{stats.offCampus}</h3><p>Off-Campus</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon purple">📊</div>
                    <div className="stat-info"><h3>{stats.total}</h3><p>Total Students</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon cyan">🎯</div>
                    <div className="stat-info"><h3>{stats.round1Allotted}</h3><p>Round 1</p></div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow">🔄</div>
                    <div className="stat-info"><h3>{stats.round2Allotted}</h3><p>Round 2</p></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar">
                {['overview', 'blocks', 'allotted', 'waitlisted', 'off-campus'].map(tab => (
                    <button
                        key={tab}
                        className={`tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab); if (tab !== 'blocks') setSelectedBlock(null); }}
                    >
                        {tab === 'overview' ? '📊 Charts' :
                            tab === 'blocks' ? '🏢 Block-wise' :
                                tab === 'allotted' ? `✅ Allotted (${stats.allotted})` :
                                    tab === 'waitlisted' ? `⏳ Waitlisted (${stats.waitlisted})` :
                                        `🚫 Off-Campus (${stats.offCampus})`}
                    </button>
                ))}
            </div>

            {/* ================== OVERVIEW TAB ================== */}
            {activeTab === 'overview' && (
                <div className="animate-in">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        {/* Capacity vs Occupancy - bar chart */}
                        <div className="card">
                            <div className="card-header"><span className="card-title">🏢 Block Capacity vs Allotted</span></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={blockChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3550', borderRadius: '8px', color: '#f1f5f9' }} />
                                    <Bar dataKey="capacity" fill="#334155" radius={[4, 4, 0, 0]} name="Capacity" />
                                    <Bar dataKey="allotted" fill="#6366f1" radius={[4, 4, 0, 0]} name="Allotted" />
                                    <Legend />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card">
                            <div className="card-header"><span className="card-title">🏷️ Room Type Distribution</span></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={roomTypeChartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {roomTypeChartData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3550', borderRadius: '8px', color: '#f1f5f9' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card">
                            <div className="card-header"><span className="card-title">👤 Gender Split</span></div>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        <Cell fill="#06b6d4" />
                                        <Cell fill="#ec4899" />
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3550', borderRadius: '8px', color: '#f1f5f9' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card">
                            <div className="card-header"><span className="card-title">📅 Year Distribution</span></div>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={yearData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ background: '#1a2235', border: '1px solid #2a3550', borderRadius: '8px', color: '#f1f5f9' }} />
                                    <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Enhanced Block Stats Table */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">🏢 Block-wise Statistics</span></div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Block</th>
                                        <th>Gender</th>
                                        <th>Capacity</th>
                                        <th>Allotted</th>
                                        <th>Occupancy</th>
                                        <th>Avg CGPA</th>
                                        <th>Cutoff CGPA</th>
                                        <th>Room Types</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.blockStats?.map(b => (
                                        <tr key={b.blockNumber}>
                                            <td style={{ fontWeight: 700 }}>Block {b.blockNumber}</td>
                                            <td>
                                                <span className={`badge ${b.gender === 'MALE' ? 'badge-info' : 'badge-purple'}`}>
                                                    {b.gender === 'MALE' ? '👦 Boys' : '👧 Girls'}
                                                </span>
                                            </td>
                                            <td>{b.totalBeds} beds</td>
                                            <td>{b.allotted}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '60px', height: '6px', background: 'rgba(255,255,255,0.08)',
                                                        borderRadius: '3px', overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${Math.min(b.occupancyPercent, 100)}%`, height: '100%',
                                                            background: b.occupancyPercent > 90 ? '#ef4444' : b.occupancyPercent > 70 ? '#f59e0b' : '#22c55e',
                                                            borderRadius: '3px',
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: b.occupancyPercent > 90 ? '#ef4444' : b.occupancyPercent > 70 ? '#f59e0b' : '#22c55e' }}>
                                                        {b.occupancyPercent}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{b.avgCgpa || '—'}</td>
                                            <td style={{ fontWeight: 600, color: '#f59e0b' }}>
                                                {b.minCgpa !== null ? b.minCgpa : '—'}
                                            </td>
                                            <td>
                                                {Object.entries(b.roomTypes || {}).map(([code, count]) => (
                                                    <span key={code} className="badge badge-info" style={{ marginRight: '4px', fontSize: '11px' }}>
                                                        {code}: {count}
                                                    </span>
                                                ))}
                                                {Object.keys(b.roomTypes || {}).length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ================== BLOCKS TAB ================== */}
            {activeTab === 'blocks' && (
                <div className="animate-in">
                    {/* Block selector cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        {stats.blockStats?.filter(b => b.allotted > 0).map(b => (
                            <button
                                key={b.blockNumber}
                                onClick={() => setSelectedBlock(b.blockNumber)}
                                style={{
                                    padding: '16px 12px',
                                    background: selectedBlock === b.blockNumber ? 'rgba(99, 102, 241, 0.15)' : 'var(--gradient-card)',
                                    border: `1px solid ${selectedBlock === b.blockNumber ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-color)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    color: 'inherit',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-heading)' }}>Block {b.blockNumber}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {b.allotted} students
                                </div>
                                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                    <span className={`badge ${b.gender === 'MALE' ? 'badge-info' : 'badge-purple'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                        {b.gender === 'MALE' ? 'Boys' : 'Girls'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Block detail + room preview */}
                    {selectedBlock ? (
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="card-title">🏢 Block {selectedBlock} — Room-wise Allotment</span>
                                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={() => downloadBlockCSV(selectedBlock)}>
                                    📥 Download Block {selectedBlock} CSV
                                </button>
                            </div>

                            {/* Summary bar */}
                            {(() => {
                                const bData = stats.blockStats?.find(b => b.blockNumber === selectedBlock);
                                if (!bData) return null;
                                return (
                                    <div style={{ display: 'flex', gap: '24px', padding: '12px 0', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Capacity: </span>
                                            <strong>{bData.totalBeds}</strong> beds
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Allotted: </span>
                                            <strong style={{ color: '#22c55e' }}>{bData.allotted}</strong>
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Occupancy: </span>
                                            <strong style={{ color: bData.occupancyPercent > 90 ? '#ef4444' : '#22c55e' }}>{bData.occupancyPercent}%</strong>
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Avg CGPA: </span>
                                            <strong>{bData.avgCgpa}</strong>
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Cutoff CGPA: </span>
                                            <strong style={{ color: '#f59e0b' }}>{bData.minCgpa ?? '—'}</strong>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Room table */}
                            <div className="table-container" style={{ maxHeight: '500px', overflow: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Room</th>
                                            <th>Floor</th>
                                            <th>Type</th>
                                            <th>Cap</th>
                                            <th>Occupant Reg No</th>
                                            <th>Name</th>
                                            <th>Year</th>
                                            <th>Dept</th>
                                            <th>CGPA</th>
                                            <th>Round</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blockRoomList.map((room) =>
                                            room.occupants.map((occ, oi) => (
                                                <tr key={`${room.roomNumber}-${oi}`}>
                                                    {oi === 0 ? (
                                                        <>
                                                            <td rowSpan={room.occupants.length} style={{ fontWeight: 700, borderRight: '1px solid var(--border-light)', verticalAlign: 'top' }}>
                                                                {room.roomNumber}
                                                            </td>
                                                            <td rowSpan={room.occupants.length} style={{ verticalAlign: 'top' }}>{room.floor}</td>
                                                            <td rowSpan={room.occupants.length} style={{ verticalAlign: 'top' }}>
                                                                <span className="badge badge-info" style={{ fontSize: '11px' }}>{room.roomType}</span>
                                                            </td>
                                                            <td rowSpan={room.occupants.length} style={{ verticalAlign: 'top' }}>
                                                                {room.occupants.length}/{room.capacity}
                                                            </td>
                                                        </>
                                                    ) : null}
                                                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{occ.regNo}</td>
                                                    <td style={{ fontWeight: 500 }}>{occ.name}</td>
                                                    <td>{occ.year}</td>
                                                    <td>{occ.department}</td>
                                                    <td>{occ.cgpa}</td>
                                                    <td><span className={`badge ${occ.round === 1 ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>R{occ.round}</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                                Showing {blockRoomList.length} occupied rooms · {blockRoomList.reduce((s, r) => s + r.occupants.length, 0)} students
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <h3>Select a block above</h3>
                            <p style={{ color: 'var(--text-muted)' }}>Click on a block card to view its room-wise allotment details</p>
                        </div>
                    )}
                </div>
            )}

            {/* ================== ALLOTTED TAB ================== */}
            {activeTab === 'allotted' && (
                <div className="animate-in">
                    <div className="search-bar" style={{ marginBottom: '16px' }}>
                        <input
                            className="input"
                            placeholder="Search by name, reg no, or department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="table-container" style={{ maxHeight: '600px', overflow: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Reg No</th><th>Name</th><th>Gender</th><th>Year</th>
                                    <th>Dept</th><th>CGPA</th><th>Block</th><th>Room</th>
                                    <th>Type</th><th>Round</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAllotted.map((s, i) => (
                                    <tr key={i}>
                                        <td>{s.regNo}</td>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td><span className={`badge ${s.gender === 'MALE' ? 'badge-info' : 'badge-purple'}`}>{s.gender === 'MALE' ? 'M' : 'F'}</span></td>
                                        <td>{s.year}</td>
                                        <td>{s.department}</td>
                                        <td>{s.cgpa}</td>
                                        <td style={{ fontWeight: 700 }}>Block {s.block}</td>
                                        <td>{s.roomNumber}</td>
                                        <td><span className="badge badge-info">{s.roomType}</span></td>
                                        <td><span className={`badge ${s.round === 1 ? 'badge-success' : 'badge-warning'}`}>R{s.round}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ================== WAITLISTED TAB ================== */}
            {activeTab === 'waitlisted' && (
                <div className="animate-in">
                    {stats.waitlistedList?.length === 0 ? (
                        <div className="empty-state"><h3>No waitlisted students</h3></div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Reg No</th><th>Name</th><th>Gender</th><th>Year</th><th>Dept</th><th>CGPA</th></tr>
                                </thead>
                                <tbody>
                                    {stats.waitlistedList?.map((s, i) => (
                                        <tr key={i}>
                                            <td>{s.regNo}</td><td>{s.name}</td>
                                            <td><span className={`badge ${s.gender === 'MALE' ? 'badge-info' : 'badge-purple'}`}>{s.gender === 'MALE' ? 'M' : 'F'}</span></td>
                                            <td>{s.year}</td><td>{s.department}</td><td>{s.cgpa}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ================== OFF-CAMPUS TAB ================== */}
            {activeTab === 'off-campus' && (
                <div className="animate-in">
                    {stats.offCampusList?.length === 0 ? (
                        <div className="empty-state"><h3>No off-campus students</h3></div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr><th>Reg No</th><th>Name</th><th>Gender</th><th>Year</th><th>Dept</th><th>CGPA</th></tr>
                                </thead>
                                <tbody>
                                    {stats.offCampusList?.map((s, i) => (
                                        <tr key={i}>
                                            <td>{s.regNo}</td><td>{s.name}</td>
                                            <td><span className={`badge ${s.gender === 'MALE' ? 'badge-info' : 'badge-purple'}`}>{s.gender === 'MALE' ? 'M' : 'F'}</span></td>
                                            <td>{s.year}</td><td>{s.department}</td><td>{s.cgpa}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
