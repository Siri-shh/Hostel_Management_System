'use client';

import { useState, useEffect } from 'react';

export default function AllotmentPage() {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [roundStats, setRoundStats] = useState(null);
    const [error, setError] = useState('');
    const [algoMode, setAlgoMode] = useState('preference_only');

    // Verification panel state
    const [r1Allotments, setR1Allotments] = useState([]);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [disallowing, setDisallowing] = useState(null); // allotment ID being disallowed

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBlock, setFilterBlock] = useState('ALL');
    const [filterPlacedBy, setFilterPlacedBy] = useState('ALL');
    const [filterRoomType, setFilterRoomType] = useState('ALL');
    const [sortBy, setSortBy] = useState('block-room');

    useEffect(() => { fetchSessions(); }, []);

    async function fetchSessions() {
        try {
            const res = await fetch('/api/sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
            const active = data.sessions?.find(s =>
                ['DRAFT', 'ROUND1_DONE', 'ROUND1_LOCKED'].includes(s.status)
            );
            if (active) setSelectedSession(active);
        } catch {
            setError('Failed to load sessions');
        } finally {
            setLoading(false);
        }
    }

    async function fetchR1Allotments(sessionId) {
        setVerifyLoading(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/r1-allotments`);
            const data = await res.json();
            setR1Allotments(data.allotments || []);
        } catch {
            setError('Failed to load Round 1 allotments');
        } finally {
            setVerifyLoading(false);
        }
    }

    useEffect(() => {
        if (selectedSession?.status === 'ROUND1_DONE') {
            fetchR1Allotments(selectedSession.id);
        } else {
            setR1Allotments([]);
        }
    }, [selectedSession]);

    async function runRound(round) {
        if (!selectedSession) return;
        setRunning(true);
        setError('');
        setRoundStats(null);
        try {
            const res = await fetch('/api/allotment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: selectedSession.id, round, mode: algoMode }),
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setRoundStats(data);
                await fetchSessions();
            }
        } catch (err) {
            setError('Allotment failed: ' + err.message);
        } finally {
            setRunning(false);
        }
    }

    async function disallowAllotment(allotmentId, names) {
        if (!confirm(`Disallow allotment for: ${names}?\n\nThey will NOT be eligible for Round 2 and this room will become vacant.`)) return;
        setDisallowing(allotmentId);
        try {
            const res = await fetch(`/api/allotments/${allotmentId}/disallow`, { method: 'PATCH' });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                // Remove all allotments with the same groupId from the list
                const disallowedGroupId = r1Allotments.find(a => a.id === allotmentId)?.groupId;
                setR1Allotments(prev => prev.filter(a => a.groupId !== disallowedGroupId));
            }
        } catch (err) {
            setError('Disallow failed: ' + err.message);
        } finally {
            setDisallowing(null);
        }
    }

    async function lockRound1() {
        if (!selectedSession) return;
        if (!confirm('Lock Round 1? No more disallowals will be possible. Round 2 will become available.')) return;
        setRunning(true);
        setError('');
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}/lock-round1`, { method: 'PATCH' });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                await fetchSessions();
            }
        } catch (err) {
            setError('Lock failed: ' + err.message);
        } finally {
            setRunning(false);
        }
    }

    async function resetSession() {
        if (!selectedSession) return;
        if (!confirm(`Reset session "${selectedSession.name}"? This will delete all allotment results. Students and groups will be preserved.`)) return;
        setRunning(true);
        setError('');
        setRoundStats(null);
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}/reset`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) { setError(data.error); } else { await fetchSessions(); }
        } catch (err) { setError('Reset failed: ' + err.message); }
        finally { setRunning(false); }
    }

    async function deleteSession() {
        if (!selectedSession) return;
        if (!confirm(`PERMANENTLY DELETE session "${selectedSession.name}"? This will completely remove all students, groups, and allotment results.`)) return;
        setRunning(true);
        setError('');
        setRoundStats(null);
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) { setError(data.error); } else { setSelectedSession(null); setRoundStats(null); await fetchSessions(); }
        } catch (err) { setError('Delete failed: ' + err.message); }
        finally { setRunning(false); }
    }

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header"><div><h1>Run Allotment</h1></div></div>
                <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            </div>
        );
    }

    const statusBadge = (status) => {
        const map = {
            DRAFT: 'badge-info', ROUND1_DONE: 'badge-warning',
            ROUND1_LOCKED: 'badge-purple', ROUND2_DONE: 'badge-success'
        };
        return <span className={`badge ${map[status] || 'badge-info'}`}>{status.replace(/_/g, ' ')}</span>;
    };

    // Group allotments by groupId for display and apply filtering/sorting
    let displayGroups = Object.values(r1Allotments.reduce((acc, a) => {
        if (!acc[a.groupId]) acc[a.groupId] = [];
        acc[a.groupId].push(a);
        return acc;
    }, {}));

    // Filtering
    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        displayGroups = displayGroups.filter(g => 
            g.some(a => a.student.name.toLowerCase().includes(q) || a.student.regNo.toLowerCase().includes(q))
        );
    }
    if (filterBlock !== 'ALL') {
        displayGroups = displayGroups.filter(g => g[0].room?.block?.number.toString() === filterBlock);
    }
    if (filterPlacedBy !== 'ALL') {
        displayGroups = displayGroups.filter(g => g[0].placedBy === filterPlacedBy);
    }
    if (filterRoomType !== 'ALL') {
        displayGroups = displayGroups.filter(g => g[0].room?.roomType?.code === filterRoomType);
    }

    // Sorting
    displayGroups.sort((gA, gB) => {
        const aFirst = gA[0];
        const bFirst = gB[0];
        if (sortBy === 'cgpa-desc') {
            const avgA = gA.reduce((s, a) => s + a.student.cgpa, 0) / gA.length;
            const avgB = gB.reduce((s, b) => s + b.student.cgpa, 0) / gB.length;
            return avgB - avgA;
        }
        if (sortBy === 'cgpa-asc') {
            const avgA = gA.reduce((s, a) => s + a.student.cgpa, 0) / gA.length;
            const avgB = gB.reduce((s, b) => s + b.student.cgpa, 0) / gB.length;
            return avgA - avgB;
        }
        if (sortBy === 'size-desc') {
            return gB.length - gA.length;
        }
        // Default: block-room
        if (aFirst.room?.block?.number !== bFirst.room?.block?.number) {
            return (aFirst.room?.block?.number || 0) - (bFirst.room?.block?.number || 0);
        }
        return (aFirst.room?.roomNumber || '').localeCompare(bFirst.room?.roomNumber || '');
    });

    // Options for dropdowns
    const uniqueBlocks = [...new Set(r1Allotments.map(a => a.room?.block?.number).filter(Boolean))].sort((a, b) => a - b);
    const uniqueRoomTypes = [...new Set(r1Allotments.map(a => a.room?.roomType?.code).filter(Boolean))].sort();

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Run Allotment</h1>
                    <p>Execute the CGPA + Year-based room allotment algorithm</p>
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="empty-state">
                    <h3>No sessions found</h3>
                    <p>Upload a CSV first to create an allotment session</p>
                    <a href="/admin/upload" className="btn btn-primary" style={{ marginTop: '16px' }}>📁 Upload CSV</a>
                </div>
            ) : (
                <>
                    {/* Session Selector */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="card-header"><span className="card-title">📋 Select Session</span></div>
                        <select
                            className="input"
                            value={selectedSession?.id || ''}
                            onChange={(e) => {
                                const s = sessions.find(s => s.id === parseInt(e.target.value));
                                setSelectedSession(s);
                                setRoundStats(null);
                                setError('');
                            }}
                        >
                            <option value="">— Select a session —</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} — {s.status.replace(/_/g, ' ')} ({s._count?.students || 0} students)
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedSession && (
                        <>
                            {/* ====== DRAFT: Mode Selection + Run R1 ====== */}
                            {selectedSession.status === 'DRAFT' && (
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <div className="card-header">
                                        <span className="card-title">⚙️ Algorithm Mode</span>
                                        {statusBadge(selectedSession.status)}
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                                        Choose how Round 1 assigns rooms to students who don&apos;t get their preferences.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                        {/* Preference Only mode */}
                                        <label
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '8px',
                                                padding: '20px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                border: `2px solid ${algoMode === 'preference_only' ? 'rgba(99,102,241,0.6)' : 'var(--border-color)'}`,
                                                background: algoMode === 'preference_only' ? 'rgba(99,102,241,0.08)' : 'var(--gradient-card)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <input type="radio" name="algoMode" value="preference_only"
                                                checked={algoMode === 'preference_only'}
                                                onChange={() => setAlgoMode('preference_only')}
                                                style={{ display: 'none' }}
                                            />
                                            <div style={{ fontSize: '22px' }}>🎯</div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '15px' }}>Preference Only (Classic)</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                                R1 places students only in their chosen Pref1 or Pref2. All others are <strong>waitlisted</strong> for Round 2, which does the vacancy fill.
                                            </div>
                                            <div style={{ marginTop: '8px' }}>
                                                <span className="badge badge-info" style={{ fontSize: '11px' }}>Recommended for 2-round review</span>
                                            </div>
                                        </label>
                                        {/* Smart Vacancy mode */}
                                        <label
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '8px',
                                                padding: '20px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                border: `2px solid ${algoMode === 'smart_vacancy' ? 'rgba(34,197,94,0.6)' : 'var(--border-color)'}`,
                                                background: algoMode === 'smart_vacancy' ? 'rgba(34,197,94,0.05)' : 'var(--gradient-card)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <input type="radio" name="algoMode" value="smart_vacancy"
                                                checked={algoMode === 'smart_vacancy'}
                                                onChange={() => setAlgoMode('smart_vacancy')}
                                                style={{ display: 'none' }}
                                            />
                                            <div style={{ fontSize: '22px' }}>⚡</div>
                                            <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '15px' }}>Smart Vacancy Fill</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                                R1 also tries block-priority vacancy fill if preferences are full. Maximises R1 placements. Round 2 is mostly a formality.
                                            </div>
                                            <div style={{ marginTop: '8px' }}>
                                                <span className="badge badge-success" style={{ fontSize: '11px' }}>Fewer waitlisted students</span>
                                            </div>
                                        </label>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button className="btn btn-primary btn-lg" onClick={() => runRound(1)} disabled={running}>
                                            {running ? <><span className="spinner" /> Running Round 1...</> : '🚀 Run Round 1'}
                                        </button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginLeft: 'auto' }} onClick={deleteSession} disabled={running}>
                                            🗑️ Delete Session
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ====== ROUND1_DONE: Verification Panel ====== */}
                            {selectedSession.status === 'ROUND1_DONE' && (
                                <div className="card animate-in" style={{ marginBottom: '24px' }}>
                                    <div className="card-header">
                                        <span className="card-title">🔍 Review Round 1 Allotments</span>
                                        {statusBadge(selectedSession.status)}
                                    </div>
                                    <div style={{
                                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                                        borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px',
                                        fontSize: '14px', color: 'var(--text-secondary)'
                                    }}>
                                        ⚠️ <strong>Verification Required:</strong> Review the allotments below. You may disallow any group — their room will become vacant for Round 2, and they will not be eligible for further allotment.
                                        Once satisfied, click <strong>&quot;Lock Round 1 &amp; Proceed&quot;</strong> to enable Round 2.
                                    </div>

                                    {verifyLoading ? (
                                        <div className="empty-state"><span className="spinner" style={{ width: 28, height: 28 }} /></div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                <div style={{ flex: 1, minWidth: '200px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Search</label>
                                                    <input type="text" className="input" placeholder="Search name or reg no..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                                </div>
                                                <div style={{ minWidth: '120px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Block</label>
                                                    <select className="input" value={filterBlock} onChange={e => setFilterBlock(e.target.value)}>
                                                        <option value="ALL">All Blocks</option>
                                                        {uniqueBlocks.map(b => <option key={b} value={b}>Block {b}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ minWidth: '120px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Placed By</label>
                                                    <select className="input" value={filterPlacedBy} onChange={e => setFilterPlacedBy(e.target.value)}>
                                                        <option value="ALL">All Sources</option>
                                                        <option value="pref1">Pref 1</option>
                                                        <option value="pref2">Pref 2</option>
                                                        <option value="vacancy">Vacancy</option>
                                                    </select>
                                                </div>
                                                <div style={{ minWidth: '140px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Room Type</label>
                                                    <select className="input" value={filterRoomType} onChange={e => setFilterRoomType(e.target.value)}>
                                                        <option value="ALL">All Types</option>
                                                        {uniqueRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ minWidth: '160px' }}>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Sort By</label>
                                                    <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                                        <option value="block-room">Block & Room Number</option>
                                                        <option value="cgpa-desc">CGPA (High to Low)</option>
                                                        <option value="cgpa-asc">CGPA (Low to High)</option>
                                                        <option value="size-desc">Group Size (Largest first)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Showing {displayGroups.length} groups ({displayGroups.reduce((acc, g) => acc + g.length, 0)} students) {displayGroups.length !== Object.keys(r1Allotments.reduce((acc, a) => { acc[a.groupId] = true; return acc; }, {})).length ? ` (filtered from ${Object.keys(r1Allotments.reduce((acc, a) => { acc[a.groupId] = true; return acc; }, {})).length} total allocated groups)` : ''}</span>
                                            </div>
                                            <div className="table-container" style={{ maxHeight: '480px', overflow: 'auto', marginBottom: '20px' }}>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Group</th>
                                                            <th>Reg No(s)</th>
                                                            <th>Name(s)</th>
                                                            <th>CGPA</th>
                                                            <th>Block</th>
                                                            <th>Room</th>
                                                            <th>Type</th>
                                                            <th>How Placed</th>
                                                            <th>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {displayGroups.map((group) => {
                                                            const first = group[0];
                                                            const names = group.map(a => a.student.name).join(', ');
                                                            const regNos = group.map(a => a.student.regNo).join(', ');
                                                            const cgpas = group.map(a => a.student.cgpa).join(', ');
                                                            return (
                                                                <tr key={first.groupId}>
                                                                    <td><span className="badge badge-info" style={{ fontSize: '11px' }}>×{group.length}</span></td>
                                                                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{regNos}</td>
                                                                    <td style={{ fontWeight: 500 }}>{names}</td>
                                                                    <td>{cgpas}</td>
                                                                    <td style={{ fontWeight: 700 }}>Block {first.room?.block?.number}</td>
                                                                    <td>{first.room?.roomNumber}</td>
                                                                    <td><span className="badge badge-info" style={{ fontSize: '11px' }}>{first.room?.roomType?.code}</span></td>
                                                                    <td>
                                                                        <span className={`badge ${first.placedBy === 'pref1' ? 'badge-success' : first.placedBy === 'pref2' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '11px' }}>
                                                                            {first.placedBy === 'pref1' ? '🎯 Pref 1' : first.placedBy === 'pref2' ? '🔄 Pref 2' : '⚡ Vacancy'}
                                                                        </span>
                                                                    </td>
                                                                    <td>
                                                                        <button
                                                                            className="btn"
                                                                            style={{ fontSize: '12px', padding: '5px 12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                                                                            onClick={() => disallowAllotment(first.id, names)}
                                                                            disabled={disallowing === first.id}
                                                                        >
                                                                            {disallowing === first.id ? <span className="spinner" /> : '🚫 Disallow'}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                <button className="btn btn-success btn-lg" onClick={lockRound1} disabled={running}>
                                                    {running ? <><span className="spinner" /> Locking...</> : '🔒 Lock Round 1 & Proceed to Round 2'}
                                                </button>
                                                <a href={`/admin/results/${selectedSession.id}`} className="btn btn-outline btn-lg">📊 View Full R1 Results</a>
                                                <button className="btn btn-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', marginLeft: 'auto' }} onClick={resetSession} disabled={running}>
                                                    🔁 Reset
                                                </button>
                                                <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={deleteSession} disabled={running}>
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ====== ROUND1_LOCKED: Proceed to R2 ====== */}
                            {selectedSession.status === 'ROUND1_LOCKED' && (
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <div className="card-header">
                                        <span className="card-title">⚡ Allotment Control</span>
                                        {statusBadge(selectedSession.status)}
                                    </div>
                                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '16px', fontSize: '14px' }}>
                                        🔒 <strong>Round 1 is Locked.</strong> Verification is complete. Round 2 is now available.
                                        Waitlisted students will be processed; rooms freed by disallowals will be assigned.
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        <button className="btn btn-success btn-lg" onClick={() => runRound(2)} disabled={running}>
                                            {running ? <><span className="spinner" /> Running Round 2...</> : '🔄 Run Round 2 — Fill Vacancies'}
                                        </button>
                                        <a href={`/admin/results/${selectedSession.id}`} className="btn btn-outline btn-lg">📊 View R1 Results</a>
                                        <button className="btn btn-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', marginLeft: 'auto' }} onClick={resetSession} disabled={running}>🔁 Reset</button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={deleteSession} disabled={running}>🗑️ Delete</button>
                                    </div>
                                </div>
                            )}

                            {/* ====== ROUND2_DONE ====== */}
                            {selectedSession.status === 'ROUND2_DONE' && (
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <div className="card-header">
                                        <span className="card-title">✅ Allotment Complete</span>
                                        {statusBadge(selectedSession.status)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                                        <a href={`/admin/results/${selectedSession.id}`} className="btn btn-primary btn-lg">📊 View Final Results</a>
                                        <button className="btn btn-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', marginLeft: 'auto' }} onClick={resetSession} disabled={running}>🔁 Reset</button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={deleteSession} disabled={running}>🗑️ Delete</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Round Stats */}
                    {roundStats && (
                        <div className="card animate-in">
                            <div className="card-header"><span className="card-title">📊 Round {roundStats.round} Results</span></div>
                            <div className="stats-grid" style={{ marginBottom: '0' }}>
                                <div className="stat-card">
                                    <div className="stat-icon green">✅</div>
                                    <div className="stat-info"><h3>{roundStats.allottedStudents}</h3><p>Students Allotted</p></div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon purple">🎯</div>
                                    <div className="stat-info"><h3>{roundStats.allottedPref1}</h3><p>Got Pref 1</p></div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon cyan">🔄</div>
                                    <div className="stat-info"><h3>{roundStats.allottedPref2}</h3><p>Got Pref 2</p></div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon yellow">⚡</div>
                                    <div className="stat-info"><h3>{roundStats.allottedRandom}</h3><p>Vacancy Fill</p></div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon red">⏳</div>
                                    <div className="stat-info">
                                        <h3>{roundStats.waitlistedStudents}</h3>
                                        <p>{roundStats.round === 1 ? 'Waitlisted' : 'Off-Campus'}</p>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: '16px' }}>
                                <a href={`/admin/results/${selectedSession?.id}`} className="btn btn-primary">View Full Results →</a>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="error-list" style={{ marginTop: '20px' }}>
                            <h4>⚠️ Error</h4>
                            <ul><li>{error}</li></ul>
                        </div>
                    )}
                </>
            )}

            {/* Algorithm Info */}
            <div className="card" style={{ marginTop: '32px' }}>
                <div className="card-header"><span className="card-title">ℹ️ How the Algorithm Works</span></div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.9' }}>
                    <p><strong>🎯 Preference Only (Classic):</strong> Round 1 sorts all groups by CGPA (desc), with year as tiebreaker — Year 2 &gt; Year 3 &gt; Year 4. Each group tries Pref 1 → Pref 2. If neither is available, the group is <strong>waitlisted</strong>. No random assignments in R1.</p>
                    <p><strong>⚡ Smart Vacancy Fill:</strong> Same as above, but if Pref 1 and Pref 2 are both full, the engine also searches <em>all</em> compatible rooms in block-popularity order (most-demanded blocks first), filling partial rooms before empty ones. This minimises the waitlist after R1.</p>
                    <p><strong>🔍 Admin Verification (between R1 and R2):</strong> After Round 1, the admin may <strong>disallow</strong> any allotment group. Disallowed students are ineligible for R2, and their room becomes available. Once all reviews are done, the admin <strong>locks Round 1</strong> to proceed.</p>
                    <p><strong>🔄 Round 2:</strong> Only available after R1 is locked. Waitlisted groups (re-sorted by CGPA + year) retry Pref 1 → Pref 2 → Smart Vacancy. Disallowed rooms are now available for assignment. Students still unplaced go off-campus.</p>
                    <p><strong>📐 Room packing:</strong> Partial rooms are filled before empty ones. Solo students in double/triple rooms share with other solos of the same gender. Groups are <em>never</em> split across rooms.</p>
                </div>
            </div>
        </div>
    );
}
