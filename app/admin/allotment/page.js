'use client';

import { useState, useEffect } from 'react';

export default function AllotmentPage() {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [roundStats, setRoundStats] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSessions();
    }, []);

    async function fetchSessions() {
        try {
            const res = await fetch('/api/sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
            // Auto-select the latest DRAFT or ROUND1_DONE session
            const active = data.sessions?.find(s => s.status === 'DRAFT' || s.status === 'ROUND1_DONE');
            if (active) setSelectedSession(active);
        } catch (err) {
            setError('Failed to load sessions');
        } finally {
            setLoading(false);
        }
    }

    async function runRound(round) {
        if (!selectedSession) return;
        setRunning(true);
        setError('');
        setRoundStats(null);
        try {
            const res = await fetch('/api/allotment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: selectedSession.id, round }),
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setRoundStats(data);
                // Refresh sessions
                await fetchSessions();
            }
        } catch (err) {
            setError('Allotment failed: ' + err.message);
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
            if (data.error) {
                setError(data.error);
            } else {
                setRoundStats(null);
                await fetchSessions();
            }
        } catch (err) {
            setError('Reset failed: ' + err.message);
        } finally {
            setRunning(false);
        }
    }

    async function deleteSession() {
        if (!selectedSession) return;
        if (!confirm(`PERMANENTLY DELETE session "${selectedSession.name}"? This will completely remove all students, groups, and allotment results for this session.`)) return;
        setRunning(true);
        setError('');
        setRoundStats(null);
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setSelectedSession(null);
                setRoundStats(null);
                await fetchSessions();
            }
        } catch (err) {
            setError('Delete failed: ' + err.message);
        } finally {
            setRunning(false);
        }
    }

    if (loading) {
        return (
            <div className="animate-in">
                <div className="page-header"><div><h1>Run Allotment</h1></div></div>
                <div className="empty-state"><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Run Allotment</h1>
                    <p>Execute the CGPA-based room allotment algorithm</p>
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
                        <div className="card-header">
                            <span className="card-title">📋 Select Session</span>
                        </div>
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

                    {/* Session Details + Actions */}
                    {selectedSession && (
                        <div className="card" style={{ marginBottom: '24px' }}>
                            <div className="card-header">
                                <span className="card-title">⚡ Allotment Control</span>
                                <span className={`badge ${selectedSession.status === 'ROUND2_DONE' ? 'badge-success' :
                                        selectedSession.status === 'ROUND1_DONE' ? 'badge-warning' :
                                            'badge-info'
                                    }`}>
                                    {selectedSession.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                {selectedSession.status === 'DRAFT' && (
                                    <>
                                        <button
                                            className="btn btn-primary btn-lg"
                                            onClick={() => runRound(1)}
                                            disabled={running}
                                        >
                                            {running ? <><span className="spinner" /> Running Round 1...</> : '🚀 Run Round 1 — Preference-based'}
                                        </button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginLeft: 'auto' }} onClick={deleteSession} disabled={running}>
                                            🗑️ Delete Session
                                        </button>
                                    </>
                                )}

                                {selectedSession.status === 'ROUND1_DONE' && (
                                    <>
                                        <button
                                            className="btn btn-success btn-lg"
                                            onClick={() => runRound(2)}
                                            disabled={running}
                                        >
                                            {running ? <><span className="spinner" /> Running Round 2...</> : '🔄 Run Round 2 — Fill Vacancies'}
                                        </button>
                                        <a href={`/admin/results/${selectedSession.id}`} className="btn btn-outline btn-lg">
                                            📊 View Round 1 Results
                                        </a>
                                        <button className="btn btn-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }} onClick={resetSession} disabled={running}>
                                            🔁 Reset
                                        </button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={deleteSession} disabled={running}>
                                            🗑️ Delete
                                        </button>
                                    </>
                                )}

                                {selectedSession.status === 'ROUND2_DONE' && (
                                    <>
                                        <a href={`/admin/results/${selectedSession.id}`} className="btn btn-primary btn-lg">
                                            📊 View Final Results
                                        </a>
                                        <button className="btn btn-lg" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }} onClick={resetSession} disabled={running}>
                                            🔁 Reset
                                        </button>
                                        <button className="btn btn-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={deleteSession} disabled={running}>
                                            🗑️ Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Round Stats */}
                    {roundStats && (
                        <div className="card animate-in">
                            <div className="card-header">
                                <span className="card-title">📊 Round {roundStats.round} Results</span>
                            </div>

                            <div className="stats-grid" style={{ marginBottom: '0' }}>
                                <div className="stat-card">
                                    <div className="stat-icon green">✅</div>
                                    <div className="stat-info">
                                        <h3>{roundStats.allottedStudents}</h3>
                                        <p>Students Allotted</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon purple">🎯</div>
                                    <div className="stat-info">
                                        <h3>{roundStats.allottedPref1}</h3>
                                        <p>Got Pref 1</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon cyan">🔄</div>
                                    <div className="stat-info">
                                        <h3>{roundStats.allottedPref2}</h3>
                                        <p>Got Pref 2</p>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon yellow">🎲</div>
                                    <div className="stat-info">
                                        <h3>{roundStats.allottedRandom}</h3>
                                        <p>Random Assignment</p>
                                    </div>
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
                                <a href={`/admin/results/${selectedSession.id}`} className="btn btn-primary">
                                    View Full Results →
                                </a>
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
                <div className="card-header">
                    <span className="card-title">ℹ️ How the Algorithm Works</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8' }}>
                    <p><strong>Round 1 (Preference Round):</strong> Groups sorted by CGPA (descending). Each group tries Pref 1 → Pref 2. If neither is available, the group is <strong>waitlisted</strong>. No random assignments in this round.</p>
                    <p><strong>Round 2 (Vacancy Round):</strong> Waitlisted groups (still sorted by CGPA) try Pref 1 → Pref 2 → then <strong>any available room</strong> matching their gender. This pushes occupancy to near 100%. Remaining groups go off-campus.</p>
                    <p><strong>Partial rooms:</strong> Solo students in double rooms share with other solos. Groups are never split across rooms.</p>
                </div>
            </div>
        </div>
    );
}
