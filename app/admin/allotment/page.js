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
    const [portalBusy, setPortalBusy] = useState(false);

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

    // Algorithm Rules state
    const [blockCutoffsEnabled, setBlockCutoffsEnabled] = useState(false);
    const [maxCgpaDiffEnabled, setMaxCgpaDiffEnabled] = useState(false);
    const [maxCgpaDiff, setMaxCgpaDiff] = useState('');
    const [blockRows, setBlockRows] = useState([]); // [{id, number, gender, minCgpa}]
    const [rulesSaving, setRulesSaving] = useState(false);
    const [rulesSaved, setRulesSaved] = useState(false);

    // Audit Logs state
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLogsLoading, setAuditLogsLoading] = useState(false);
    const [auditSetupMsg, setAuditSetupMsg] = useState('');
    const [auditSetupBusy, setAuditSetupBusy] = useState(false);

    useEffect(() => { 
        fetchSessions(); 
        fetchAuditLogs();
    }, []);

    async function fetchAuditLogs() {
        setAuditLogsLoading(true);
        try {
            const res = await fetch('/api/admin/audit-logs');
            const data = await res.json();
            setAuditLogs(data.logs || []);
            if (data.warning && !auditSetupMsg) {
                setAuditSetupMsg('⚠️ ' + data.warning);
            }
        } catch {
            // non-critical
        } finally {
            setAuditLogsLoading(false);
        }
    }

    async function setupAuditLog() {
        setAuditSetupBusy(true);
        setAuditSetupMsg('');
        try {
            const res = await fetch('/api/admin/setup-audit-log', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                setAuditSetupMsg('❌ ' + data.error);
            } else {
                setAuditSetupMsg('✅ ' + data.message);
                await fetchAuditLogs();
            }
        } catch (err) {
            setAuditSetupMsg('❌ Network error: ' + err.message);
        } finally {
            setAuditSetupBusy(false);
        }
    }

    async function fetchSettings(sessionId) {
        try {
            const res = await fetch(`/api/sessions/${sessionId}/settings`);
            const data = await res.json();
            setBlockCutoffsEnabled(data.blockCutoffsEnabled || false);
            setMaxCgpaDiffEnabled(data.maxCgpaDiffEnabled || false);
            setMaxCgpaDiff(data.maxCgpaDiff ?? '');
            setBlockRows(data.blocks || []);
        } catch { /* non-critical */ }
    }

    async function saveSettings() {
        if (!selectedSession) return;
        setRulesSaving(true);
        setRulesSaved(false);
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blockCutoffsEnabled,
                    maxCgpaDiffEnabled,
                    maxCgpaDiff: maxCgpaDiff === '' ? null : parseFloat(maxCgpaDiff),
                    cutoffs: blockRows.map(b => ({ blockId: b.id, minCgpa: b.minCgpa })),
                }),
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else setRulesSaved(true);
        } catch (err) {
            setError('Failed to save rules: ' + err.message);
        } finally {
            setRulesSaving(false);
        }
    }

    async function fetchSessions() {
        try {
            const res = await fetch('/api/sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
            const active = data.sessions?.find(s =>
                ['DRAFT', 'ROUND1_DONE', 'ROUND1_LOCKED'].includes(s.status)
            );
            if (active) {
                setSelectedSession(active);
                fetchSettings(active.id); // load settings for all active session states
            }
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

    async function setPortalStatus(status) {
        if (!selectedSession) return;
        
        let confirmMsg = `Are you sure you want to ${status} the student portal for session "${selectedSession.name}"?`;
        if (status === 'OPEN') {
            confirmMsg = `WARNING: Are you sure you want to OPEN the portal? \n\nChanging the portal status to OPEN will ERASE all existing student portal groups and preferences to ensure a clean slate regarding the new Algorithm Rules.\n\nProceed?`;
        }

        if (!confirm(confirmMsg)) return;
        
        setPortalBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/sessions/${selectedSession.id}/portal`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portalStatus: status }),
            });
            const data = await res.json();
            if (data.error) { setError(data.error); } else { await fetchSessions(); }
        } catch (err) { setError('Portal update failed: ' + err.message); }
        finally { setPortalBusy(false); }
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
                                setRulesSaved(false);
                                if (s?.status === 'DRAFT') fetchSettings(s.id);
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
                            {/* ====== DRAFT: Algorithm Rules + Mode Selection + Run R1 ====== */}
                            {selectedSession.status === 'DRAFT' && (
                                <>
                                {/* ── Algorithm Rules Card ── */}
                                <div className="card" style={{ marginBottom: '24px' }}>
                                    <div className="card-header">
                                        <span className="card-title">🛡️ Algorithm Rules</span>
                                        {statusBadge(selectedSession.status)}
                                    </div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                        Optional constraints applied by the algorithm during allotment. Changes take effect on the next run.
                                    </p>

                                    {/* Rule 1: Block CGPA Cutoffs */}
                                    <div style={{ background: 'var(--gradient-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: blockCutoffsEnabled ? '16px' : '0' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '14px' }}>🏢 Hard Block CGPA Cutoffs</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Set minimum CGPA per block. Students below the cutoff will not be allotted there.</div>
                                            </div>
                                            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, marginLeft: '16px' }}>
                                                <input type="checkbox" checked={blockCutoffsEnabled} onChange={e => setBlockCutoffsEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                                                <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: blockCutoffsEnabled ? 'rgb(99,102,241)' : 'var(--border-color)', borderRadius: '24px', transition: '0.2s' }}>
                                                    <span style={{ position: 'absolute', height: '18px', width: '18px', left: blockCutoffsEnabled ? '23px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.2s' }} />
                                                </span>
                                            </label>
                                        </div>
                                        {blockCutoffsEnabled && (
                                            <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Block</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Gender</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Min CGPA Cutoff</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {blockRows.map(b => (
                                                            <tr key={b.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                                                <td style={{ padding: '8px 12px', color: 'var(--text-heading)', fontWeight: 600 }}>Block {b.number}</td>
                                                                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{b.gender}</td>
                                                                <td style={{ padding: '8px 12px' }}>
                                                                    <input
                                                                        type="number" step="0.1" min="0" max="10"
                                                                        placeholder="No cutoff"
                                                                        value={b.minCgpa ?? ''}
                                                                        onChange={e => setBlockRows(rows => rows.map(r => r.id === b.id ? { ...r, minCgpa: e.target.value === '' ? null : parseFloat(e.target.value) } : r))}
                                                                        style={{ width: '110px', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-heading)', fontSize: '13px' }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Rule 2: Max CGPA Diff */}
                                    <div style={{ background: 'var(--gradient-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '14px' }}>👥 Max CGPA Gap in Pairs</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Prevents students with very different CGPAs from forming a portal group. Does not apply to CSV-imported groups.</div>
                                            </div>
                                            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, marginLeft: '16px' }}>
                                                <input type="checkbox" checked={maxCgpaDiffEnabled} onChange={e => setMaxCgpaDiffEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                                                <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: maxCgpaDiffEnabled ? 'rgb(34,197,94)' : 'var(--border-color)', borderRadius: '24px', transition: '0.2s' }}>
                                                    <span style={{ position: 'absolute', height: '18px', width: '18px', left: maxCgpaDiffEnabled ? '23px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.2s' }} />
                                                </span>
                                            </label>
                                        </div>
                                        {maxCgpaDiffEnabled && (
                                            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Max allowed CGPA difference:</label>
                                                <input
                                                    type="number" step="0.1" min="0.1" max="10"
                                                    placeholder="e.g. 1.0"
                                                    value={maxCgpaDiff}
                                                    onChange={e => setMaxCgpaDiff(e.target.value)}
                                                    style={{ width: '100px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-heading)', fontSize: '14px' }}
                                                />
                                                {maxCgpaDiff && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>e.g. 8.5 and 7.5 would {parseFloat(maxCgpaDiff) >= 1 ? '✅ pass' : '❌ fail'} (diff = 1.0)</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button className="btn btn-primary" onClick={saveSettings} disabled={rulesSaving}>
                                            {rulesSaving ? <><span className="spinner" /> Saving...</> : '💾 Save Rules'}
                                        </button>
                                        {rulesSaved && <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>✅ Saved!</span>}
                                    </div>
                                </div>

                                {/* ── Algorithm Mode + Run Round 1 Card ── */}
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
                                </>
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

            {/* Student Portal Control */}
            {selectedSession && (
                <div className="card" style={{ marginTop: '24px' }}>
                    <div className="card-header">
                        <span className="card-title">🎓 Student Portal Control</span>
                        {selectedSession.portalStatus && (
                            <span className={`badge ${selectedSession.portalStatus === 'OPEN' ? 'badge-success' : selectedSession.portalStatus === 'LOCKED' ? 'badge-warning' : 'badge-info'}`}>
                                {selectedSession.portalStatus === 'OPEN' ? '🟢 Portal Open' : selectedSession.portalStatus === 'LOCKED' ? '⏳ Portal Locked' : '🔴 Portal Closed'}
                            </span>
                        )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                        Control whether students can access the portal to form groups and set preferences.
                        Students visit <strong>/student</strong> to register and apply.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button className="btn btn-success" onClick={() => setPortalStatus('OPEN')} disabled={portalBusy || selectedSession.portalStatus === 'OPEN'}>
                            {portalBusy ? <span className="spinner" /> : '🟢 Open Portal'}
                        </button>
                        <button className="btn" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }} onClick={() => setPortalStatus('LOCKED')} disabled={portalBusy || selectedSession.portalStatus === 'LOCKED'}>
                            {portalBusy ? <span className="spinner" /> : '⏳ Lock Portal (processing)'}
                        </button>
                        <button className="btn" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => setPortalStatus('CLOSED')} disabled={portalBusy || selectedSession.portalStatus === 'CLOSED'}>
                            {portalBusy ? <span className="spinner" /> : '🔴 Close Portal'}
                        </button>
                        <a href="/student" target="_blank" rel="noopener noreferrer" className="btn" style={{ marginLeft: 'auto' }}>
                            🌐 Open Student Portal →
                        </a>
                    </div>
                </div>
            )}

            {/* Session Audit Logs */}
            <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                    <span className="card-title">📜 Session Audit Logs</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--accent-blue)', color: '#fff' }}
                            onClick={setupAuditLog} disabled={auditSetupBusy}>
                            {auditSetupBusy ? '⏳ Setting up...' : '⚙️ Setup DB Trigger'}
                        </button>
                        <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={fetchAuditLogs}>
                            {auditLogsLoading ? '↻ Loading...' : '↻ Refresh Logs'}
                        </button>
                    </div>
                </div>
                {auditSetupMsg && (
                    <p style={{ fontSize: '13px', margin: '8px 0', color: auditSetupMsg.startsWith('✅') ? 'var(--accent-green)' : 'var(--danger)' }}>
                        {auditSetupMsg}
                    </p>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                    An immutable database history of session status changes tracked by Postgres triggers.
                    <strong style={{ color: 'var(--accent-blue)' }}> Run "Setup DB Trigger" once</strong> if logs aren't appearing.
                </p>

                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
                            <tr style={{ color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Date / Time</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Session</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>Previous Status</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid var(--border-color)' }}>New Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogs.length > 0 ? (
                                auditLogs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', color: 'var(--text-heading)' }}>
                                            {new Date(log.changed_at).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 600 }}>{log.session_name || `Session #${log.sessionId}`}</td>
                                        <td style={{ padding: '12px' }}>{statusBadge(log.old_status)}</td>
                                        <td style={{ padding: '12px' }}>{statusBadge(log.new_status)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {auditLogsLoading ? 'Loading logs...' : 'No audit logs found in the database.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
