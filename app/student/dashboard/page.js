'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [blocksData, setBlocksData] = useState([]);

    // Group state
    const [inviteInput, setInviteInput] = useState('');
    const [groupAction, setGroupAction] = useState(''); // 'create' | 'join'
    const [groupMsg, setGroupMsg] = useState({ type: '', text: '' });
    const [groupBusy, setGroupBusy] = useState(false);

    // Preference state
    const [showPrefForm, setShowPrefForm] = useState(false);
    const [pref1BlockId, setPref1BlockId] = useState('');
    const [pref1RtId, setPref1RtId] = useState('');
    const [pref2BlockId, setPref2BlockId] = useState('');
    const [pref2RtId, setPref2RtId] = useState('');
    const [prefBusy, setPrefBusy] = useState(false);
    const [prefMsg, setPrefMsg] = useState({ type: '', text: '' });

    const router = useRouter();

    const authHeader = () => {
        const token = localStorage.getItem('studentToken');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('studentToken');
        if (!token) { router.replace('/student/login'); return; }
        try {
            const res = await fetch('/api/student/me', { headers: { Authorization: `Bearer ${token}` } });
            if (res.status === 401) { localStorage.removeItem('studentToken'); router.replace('/student/login'); return; }
            const json = await res.json();
            if (json.error) { setError(json.error); setLoading(false); return; }
            setData(json);
        } catch { setError('Failed to load data.'); }
        finally { setLoading(false); }
    }, [router]);

    const fetchBlocks = useCallback(async () => {
        try {
            const res = await fetch('/api/student/blocks');
            const json = await res.json();
            setBlocksData(json.blocks || []);
        } catch { }
    }, []);

    useEffect(() => { fetchData(); fetchBlocks(); }, [fetchData, fetchBlocks]);

    async function createGroup() {
        setGroupBusy(true); setGroupMsg({ type: '', text: '' });
        try {
            const res = await fetch('/api/student/groups', { method: 'POST', headers: authHeader() });
            const json = await res.json();
            if (!res.ok) { setGroupMsg({ type: 'error', text: json.error }); return; }
            setGroupMsg({ type: 'success', text: `Group created! Invite code: ${json.inviteCode}` });
            await fetchData();
        } finally { setGroupBusy(false); }
    }

    async function joinGroup() {
        if (!inviteInput.trim()) { setGroupMsg({ type: 'error', text: 'Enter an invite code.' }); return; }
        setGroupBusy(true); setGroupMsg({ type: '', text: '' });
        try {
            const res = await fetch('/api/student/groups/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({ inviteCode: inviteInput.trim().toUpperCase() }),
            });
            const json = await res.json();
            if (!res.ok) { setGroupMsg({ type: 'error', text: json.error }); return; }
            setGroupMsg({ type: 'success', text: json.message });
            setInviteInput('');
            await fetchData();
        } finally { setGroupBusy(false); }
    }

    async function leaveGroup() {
        if (!confirm('Are you sure you want to leave this group? If you are the leader, the group will be dissolved.')) return;
        setGroupBusy(true);
        try {
            const res = await fetch('/api/student/groups/leave', { method: 'DELETE', headers: authHeader() });
            const json = await res.json();
            setGroupMsg({ type: res.ok ? 'success' : 'error', text: json.message || json.error });
            if (res.ok) await fetchData();
        } finally { setGroupBusy(false); }
    }

    async function submitPreferences(submitLock) {
        if (!pref1BlockId || !pref1RtId || !pref2BlockId || !pref2RtId) {
            setPrefMsg({ type: 'error', text: 'Please select both Pref 1 and Pref 2 completely.' }); return;
        }
        setPrefBusy(true); setPrefMsg({ type: '', text: '' });
        try {
            const res = await fetch('/api/student/groups/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeader() },
                body: JSON.stringify({
                    pref1BlockId: parseInt(pref1BlockId), pref1RoomTypeId: parseInt(pref1RtId),
                    pref2BlockId: parseInt(pref2BlockId), pref2RoomTypeId: parseInt(pref2RtId),
                    submit: submitLock,
                }),
            });
            const json = await res.json();
            if (!res.ok) { setPrefMsg({ type: 'error', text: json.error }); return; }
            setPrefMsg({ type: 'success', text: json.message });
            if (submitLock) { setShowPrefForm(false); }
            await fetchData();
        } finally { setPrefBusy(false); }
    }

    async function logout() {
        localStorage.removeItem('studentToken');
        localStorage.removeItem('studentData');
        router.replace('/student/login');
    }

    if (loading) return (
        <div className="s-page">
            <div className="s-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <span className="s-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                    <p style={{ color: 'var(--s-text-muted)', marginTop: 16 }}>Loading your portal...</p>
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div className="s-page"><div className="s-container">
            <div className="s-alert s-alert-error" style={{ marginTop: '40px' }}>{error}</div>
            <button className="s-btn s-btn-ghost" style={{ marginTop: '16px' }} onClick={() => router.replace('/student/login')}>← Back to Login</button>
        </div></div>
    );

    const { student, session, portalGroup, allotment } = data;
    const portalStatus = session.portalStatus;
    const allotmentStatus = session.allotmentStatus;
    const isOpen = portalStatus === 'OPEN';
    const isResultsReady = allotmentStatus === 'ROUND2_DONE' || allotmentStatus === 'ROUND1_LOCKED';
    const isLeader = portalGroup?.isLeader;

    // For preference selection: filter blocks by gender
    const genderBlocks = blocksData.filter(b => b.gender === student.gender);

    // For a selected block, list valid room types for group size
    const validRoomTypes = (blockId) => {
        const block = blocksData.find(b => b.id === parseInt(blockId));
        if (!block) return [];
        return block.roomTypeBreakdown.filter(rt => rt.capacity >= (portalGroup?.members?.length || 1));
    };

    return (
        <div className="s-page">
            {/* Navbar */}
            <nav className="s-nav">
                <a href="/student" className="s-nav-brand">🏛️ MIT <span>Hostel Portal</span></a>
                <div className="s-nav-links">
                    <a href="/student/blocks" className="s-nav-link">🏢 Campus Blocks</a>
                    <button className="s-nav-link s-btn-danger" onClick={logout} style={{ border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px' }}>Logout</button>
                </div>
            </nav>

            <div className="s-container s-animate-in">
                {/* Glass Profile Header */}
                <div className="s-card s-card-glow s-animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', padding: '32px 40px', background: 'linear-gradient(135deg, rgba(26, 34, 52, 0.8) 0%, rgba(10, 15, 26, 0.9) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--s-teal), var(--s-green))', color: '#0A0F1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, fontFamily: 'Outfit' }}>
                            {student.name[0]}
                        </div>
                        <div>
                            <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.02em' }}>Welcome, {student.name.split(' ')[0]} <span style={{ opacity: 0.8 }}>👋</span></h1>
                            <p style={{ color: 'var(--s-text-secondary)', fontSize: '15px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--s-text-primary)' }}>{student.regNo}</span> <span style={{ opacity: 0.5 }}>•</span> {student.department} <span style={{ opacity: 0.5 }}>•</span> Year {student.year} <span style={{ opacity: 0.5 }}>•</span> CGPA <span style={{ color: 'var(--s-teal)', fontWeight: 600 }}>{student.cgpa}</span>
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span className={`s-badge ${student.gender === 'MALE' ? 's-badge-blue' : 's-badge-teal'}`} style={{ padding: '8px 16px', fontSize: '13px' }}>
                            {student.gender === 'MALE' ? '👦 Boys Hostel' : '👧 Girls Hostel'}
                        </span>
                        <a href="/student/blocks" className="s-btn s-btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>🏢 View Campus</a>
                    </div>
                </div>

                {/* Phase Banner */}
                {portalStatus === 'OPEN' && (
                    <div className="s-phase-banner s-phase-open">
                        🟢 <strong>Portal is Open</strong> — Form your group and set your block preferences before the deadline.
                    </div>
                )}
                {portalStatus === 'LOCKED' && !isResultsReady && (
                    <div className="s-phase-banner s-phase-locked">
                        ⏳ <strong>Applications Closed</strong> — Your application is in. Allotment is being processed by the admin.
                    </div>
                )}
                {portalStatus === 'CLOSED' && (
                    <div className="s-phase-banner s-phase-closed">
                        🔴 <strong>Portal is Currently Closed</strong> — Check back when the admin opens applications.
                    </div>
                )}
                {isResultsReady && allotment && (
                    <div className="s-phase-banner s-phase-results">
                        🎉 <strong>Results are out!</strong> — Your room has been allotted. See your details below.
                    </div>
                )}

                {/* ===== ALLOTMENT RESULT ===== */}
                {isResultsReady && allotment && (
                    <div className="s-card s-card-glow s-animate-in" style={{ marginBottom: '28px' }}>
                        <div className="s-card-header">
                            <span className="s-card-title">🏠 Your Allotment</span>
                            <span className="s-badge s-badge-green">✅ Allotted — Round {allotment.round}</span>
                        </div>
                        <div className="s-result-card">
                            <p className="s-result-label">Block</p>
                            <div className="s-result-block-num">{allotment.block}</div>
                            <div className="s-result-grid" style={{ marginTop: '24px' }}>
                                <div className="s-result-cell">
                                    <div className="s-result-label">Room Number</div>
                                    <div className="s-result-value">{allotment.roomNumber}</div>
                                </div>
                                <div className="s-result-cell">
                                    <div className="s-result-label">Floor</div>
                                    <div className="s-result-value">{allotment.floor}</div>
                                </div>
                                <div className="s-result-cell">
                                    <div className="s-result-label">Room Type</div>
                                    <div className="s-result-value">{allotment.roomType}</div>
                                </div>
                            </div>
                        </div>

                        {allotment.roommates?.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', color: 'var(--s-text-secondary)' }}>Your Roommates</div>
                                {allotment.roommates.map((r, i) => (
                                    <div key={i} className="s-member-card">
                                        <div className="s-member-avatar">{r.name[0]}</div>
                                        <div className="s-member-info">
                                            <div className="s-member-name">{r.name}</div>
                                            <div className="s-member-meta">{r.regNo} · {r.department} · Year {r.year}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isResultsReady && !allotment && (
                    <div className="s-card" style={{ textAlign: 'center', padding: '48px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>😔</div>
                        <h3 style={{ marginBottom: '8px' }}>Off-Campus</h3>
                        <p style={{ color: 'var(--s-text-muted)' }}>Unfortunately, a room could not be allotted. Please contact the hostel office.</p>
                    </div>
                )}

                {/* ===== GROUP FORMATION (portal open only) ===== */}
                {isOpen && !portalGroup && (
                    <div className="s-card s-animate-in">
                        <div className="s-card-header">
                            <span className="s-card-title">👥 Group Formation</span>
                            <span className="s-badge s-badge-amber">No Group Yet</span>
                        </div>
                        <p style={{ color: 'var(--s-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            Apply solo or team up with up to 2 friends. Groups get their average CGPA as their priority score.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                            <div className="s-card" style={{ padding: '20px', cursor: 'pointer', border: groupAction === 'create' ? '1.5px solid var(--s-teal)' : '', background: groupAction === 'create' ? 'var(--s-teal-glow)' : '' }} onClick={() => setGroupAction('create')}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>➕</div>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Create a Group</div>
                                <div style={{ fontSize: '13px', color: 'var(--s-text-muted)' }}>Start a new group and share the invite code with friends.</div>
                            </div>
                            <div className="s-card" style={{ padding: '20px', cursor: 'pointer', border: groupAction === 'join' ? '1.5px solid var(--s-teal)' : '', background: groupAction === 'join' ? 'var(--s-teal-glow)' : '' }} onClick={() => setGroupAction('join')}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔗</div>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Join a Group</div>
                                <div style={{ fontSize: '13px', color: 'var(--s-text-muted)' }}>Your friend already created a group? Enter their invite code.</div>
                            </div>
                        </div>

                        {groupAction === 'create' && (
                            <div className="s-animate-in" style={{ padding: '24px', background: 'rgba(99,209,183,0.05)', borderRadius: '16px', border: '1px solid rgba(99,209,183,0.2)', marginTop: '20px' }}>
                                <h4 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--s-text-primary)' }}>Start a New Group</h4>
                                <p style={{ color: 'var(--s-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>As the creator, you will be the group leader. You can invite up to 2 friends, and only you can submit preferences.</p>
                                <button className="s-btn s-btn-primary s-btn-lg" onClick={createGroup} disabled={groupBusy} style={{ width: '100%', justifyContent: 'center' }}>
                                    {groupBusy ? <><span className="s-spinner" /> Creating...</> : '🚀 Create My Group Now'}
                                </button>
                            </div>
                        )}

                        {groupAction === 'join' && (
                            <div className="s-animate-in" style={{ padding: '24px', background: 'rgba(96,165,250,0.05)', borderRadius: '16px', border: '1px solid rgba(96,165,250,0.2)', marginTop: '20px' }}>
                                <h4 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--s-text-primary)' }}>Join an Existing Group</h4>
                                <p style={{ color: 'var(--s-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>Ask your friend for their invite code and paste it below to join their group.</p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <input className="s-input" placeholder="Enter invite code (e.g. XC9-2B4)" value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())} style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, padding: '16px', fontSize: '16px' }} />
                                    <button className="s-btn s-btn-primary" onClick={joinGroup} disabled={groupBusy} style={{ padding: '14px 28px', fontSize: '16px' }}>
                                        {groupBusy ? <span className="s-spinner" /> : 'Join →'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {groupMsg.text && <div className={`s-alert s-alert-${groupMsg.type}`} style={{ marginTop: '12px' }}>{groupMsg.text}</div>}
                    </div>
                )}

                {/* ===== CURRENT GROUP ===== */}
                {portalGroup && (
                    <div className="s-card s-animate-in">
                        <div className="s-card-header">
                            <span className="s-card-title">👥 Your Group</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {isLeader && <span className="s-badge s-badge-teal">👑 Leader</span>}
                                {portalGroup.isSubmitted
                                    ? <span className="s-badge s-badge-green">✅ Submitted</span>
                                    : <span className="s-badge s-badge-amber">⏳ Pending</span>}
                            </div>
                        </div>

                        {/* Invite Code (if not submitted and is leader) */}
                        {isLeader && !portalGroup.isSubmitted && isOpen && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--s-text-muted)', marginBottom: '6px' }}>Share this code with friends to join your group:</div>
                                <div className="s-invite-code">{portalGroup.inviteCode}</div>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="s-stats-row" style={{ marginBottom: '20px' }}>
                            <div className="s-stat">
                                <div className="s-stat-value">{portalGroup.members.length}</div>
                                <div className="s-stat-label">Members</div>
                            </div>
                            <div className="s-stat">
                                <div className="s-stat-value">{portalGroup.avgCgpa || '—'}</div>
                                <div className="s-stat-label">Avg CGPA</div>
                            </div>
                            <div className="s-stat">
                                <div className="s-stat-value">Year {portalGroup.priorityYear || '—'}</div>
                                <div className="s-stat-label">Priority Year</div>
                            </div>
                        </div>

                        {/* Members */}
                        <div style={{ marginBottom: '20px' }}>
                            {portalGroup.members.map(m => (
                                <div key={m.id} className="s-member-card">
                                    <div className="s-member-avatar">{m.name[0]}</div>
                                    <div className="s-member-info">
                                        <div className="s-member-name">{m.name}</div>
                                        <div className="s-member-meta">{m.regNo} · {m.department} · Year {m.year} · CGPA {m.cgpa}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {m.id === student.id && <span className="s-badge s-badge-gray" style={{ fontSize: '11px' }}>You</span>}
                                        {portalGroup.isLeader && m.id === student.id && <span className="s-badge s-badge-teal" style={{ fontSize: '11px' }}>👑</span>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Preferences Display */}
                        {portalGroup.pref1 && (
                            <div style={{ marginBottom: '24px', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--s-border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', color: 'var(--s-text-primary)' }}>Saved Preferences</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ padding: '20px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '12px', transition: 'all 0.3s' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--s-green)', letterSpacing: '0.1em' }}>PRIORITY 1 🎯</div>
                                        </div>
                                        <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--s-text-primary)' }}>Block {portalGroup.pref1.block.number}</div>
                                        <div style={{ fontSize: '14px', color: 'var(--s-text-secondary)', marginTop: '4px' }}>{portalGroup.pref1.roomType?.name}</div>
                                    </div>
                                    {portalGroup.pref2 && (
                                        <div style={{ padding: '20px', background: 'rgba(99,209,183,0.06)', border: '1px dashed rgba(99,209,183,0.3)', borderRadius: '12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--s-teal)', letterSpacing: '0.1em', marginBottom: '12px' }}>BACKUP CHOICE 🔄</div>
                                            <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Outfit', color: 'var(--s-text-primary)' }}>Block {portalGroup.pref2.block.number}</div>
                                            <div style={{ fontSize: '14px', color: 'var(--s-text-secondary)', marginTop: '4px' }}>{portalGroup.pref2.roomType?.name}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Preference Form */}
                        {isLeader && isOpen && !portalGroup.isSubmitted && (
                            <>
                                <button className="s-btn s-btn-outline" onClick={() => setShowPrefForm(v => !v)} style={{ marginBottom: showPrefForm ? '16px' : '0' }}>
                                    {showPrefForm ? '✕ Hide' : (portalGroup.pref1 ? '✏️ Edit Preferences' : '🎯 Set Preferences')}
                                </button>

                                {showPrefForm && (
                                    <div className="s-animate-in" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--s-border)', marginTop: '4px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            {/* Pref 1 */}
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--s-green)', fontSize: '13px', marginBottom: '12px' }}>🎯 Preference 1</div>
                                                <div className="s-form-group">
                                                    <label className="s-label">Block</label>
                                                    <select className="s-input s-select" value={pref1BlockId} onChange={e => { setPref1BlockId(e.target.value); setPref1RtId(''); }}>
                                                        <option value="">Select Block...</option>
                                                        {genderBlocks.map(b => <option key={b.id} value={b.id}>Block {b.number} ({b.totalBeds} beds)</option>)}
                                                    </select>
                                                </div>
                                                <div className="s-form-group">
                                                    <label className="s-label">Room Type</label>
                                                    <select className="s-input s-select" value={pref1RtId} onChange={e => setPref1RtId(e.target.value)} disabled={!pref1BlockId}>
                                                        <option value="">Select Room Type...</option>
                                                        {validRoomTypes(pref1BlockId).map(rt => <option key={rt.id} value={rt.id}>{rt.name} (Cap: {rt.capacity})</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {/* Pref 2 */}
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--s-teal)', fontSize: '13px', marginBottom: '12px' }}>🔄 Preference 2</div>
                                                <div className="s-form-group">
                                                    <label className="s-label">Block</label>
                                                    <select className="s-input s-select" value={pref2BlockId} onChange={e => { setPref2BlockId(e.target.value); setPref2RtId(''); }}>
                                                        <option value="">Select Block...</option>
                                                        {genderBlocks.map(b => <option key={b.id} value={b.id}>Block {b.number} ({b.totalBeds} beds)</option>)}
                                                    </select>
                                                </div>
                                                <div className="s-form-group">
                                                    <label className="s-label">Room Type</label>
                                                    <select className="s-input s-select" value={pref2RtId} onChange={e => setPref2RtId(e.target.value)} disabled={!pref2BlockId}>
                                                        <option value="">Select Room Type...</option>
                                                        {validRoomTypes(pref2BlockId).map(rt => <option key={rt.id} value={rt.id}>{rt.name} (Cap: {rt.capacity})</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button className="s-btn s-btn-ghost" onClick={() => submitPreferences(false)} disabled={prefBusy}>
                                                {prefBusy ? <span className="s-spinner" /> : '💾 Save Draft'}
                                            </button>
                                            <button className="s-btn s-btn-primary" onClick={() => submitPreferences(true)} disabled={prefBusy}>
                                                {prefBusy ? <span className="s-spinner" /> : '✅ Submit & Lock Preferences'}
                                            </button>
                                        </div>
                                        {prefMsg.text && <div className={`s-alert s-alert-${prefMsg.type}`} style={{ marginTop: '12px' }}>{prefMsg.text}</div>}
                                    </div>
                                )}
                            </>
                        )}

                        {!isLeader && isOpen && !portalGroup.isSubmitted && (
                            <div className="s-alert s-alert-info" style={{ marginTop: '0', marginBottom: '12px' }}>
                                👑 Only the group leader can set and submit preferences.
                            </div>
                        )}

                        {isOpen && !portalGroup.isSubmitted && (
                            <>
                                <hr className="s-divider" />
                                <button className="s-btn s-btn-danger" onClick={leaveGroup} disabled={groupBusy} style={{ fontSize: '13px' }}>
                                    {isLeader ? '💥 Dissolve Group' : '🚪 Leave Group'}
                                </button>
                                {groupMsg.text && <div className={`s-alert s-alert-${groupMsg.type}`} style={{ marginTop: '12px' }}>{groupMsg.text}</div>}
                            </>
                        )}
                    </div>
                )}

                {/* Tip when no group and portal not open */}
                {!portalGroup && !isOpen && !isResultsReady && (
                    <div className="s-card" style={{ textAlign: 'center', padding: '48px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏳</div>
                        <h3 style={{ marginBottom: '8px' }}>Portal is not open yet</h3>
                        <p style={{ color: 'var(--s-text-muted)' }}>Check back when the admin opens applications. You can <a href="/student/blocks" style={{ color: 'var(--s-teal)' }}>browse campus blocks</a> in the meantime.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
