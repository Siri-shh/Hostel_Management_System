'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEPARTMENTS = [
    'AE', 'AT', 'BT', 'CE', 'CH', 'CHE', 'CS', 'CSE', 'CSBS', 'CV', 'DS',
    'EC', 'ECE', 'EE', 'EEE', 'EI', 'ENI', 'ICE', 'IE', 'IS', 'IT',
    'IM', 'MA', 'ME', 'MT', 'PE', 'PH', 'PI', 'TT',
];

// ─── Client-side validators ───────────────────────────────────────────────────
const validate = {
    regNo:  v => /^\d{9}$/.test(v.trim()),
    name:   v => /^[a-zA-Z][a-zA-Z\s]{1,49}$/.test(v.trim()) && v.trim().split(/\s+/).length >= 2,
    cgpa:   v => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 10 && /^\d+(\.\d{1,2})?$/.test(v); },
    password: v => v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v),
    confirmPassword: (v, pw) => v.length > 0 && v === pw,
};

const hints = {
    regNo: 'Exactly 9 digits, numbers only',
    name:  'First and Last name — letters only',
    cgpa:  '0.00 – 10.00 (up to 2 decimal places)',
    password: 'Min 8 chars with at least 1 letter and 1 number',
    confirmPassword: 'Must match your password exactly',
};

const errors = {
    regNo: 'Must be exactly 9 digits (numbers only)',
    name:  'Enter your full name (at least 2 words, letters only)',
    cgpa:  'Must be between 0.00 and 10.00',
    password: 'Min 8 characters including at least 1 letter and 1 number',
    confirmPassword: 'Passwords do not match',
};

// Password strength: 0 = empty, 1 = weak, 2 = fair, 3 = strong
function pwStrength(v) {
    if (!v) return 0;
    const len = v.length >= 8;
    const letter = /[a-zA-Z]/.test(v);
    const num = /\d/.test(v);
    const special = /[^a-zA-Z0-9]/.test(v);
    if (!len) return 1;
    if (len && letter && num && special) return 3;
    if (len && letter && num) return 2;
    return 1;
}
const strengthMeta = [null, { label: 'Weak', color: '#f87171' }, { label: 'Fair', color: '#fbbf24' }, { label: 'Strong', color: '#4ade80' }];

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldError({ show, msg }) {
    if (!show) return null;
    return (
        <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', padding: '4px 8px', background: 'rgba(248,113,113,0.07)', borderRadius: '5px' }}>
            ⚠ {msg}
        </div>
    );
}

function ValidDot({ valid, touched, value }) {
    if (!touched || !value) return null;
    return <span style={{ color: valid ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '15px', marginLeft: '6px' }}>{valid ? '✓' : '✗'}</span>;
}

function fieldBorder(valid, touched, value) {
    if (!touched || !value) return {};
    return {
        borderColor: valid ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)',
        boxShadow: valid ? '0 0 0 3px rgba(74,222,128,0.07)' : '0 0 0 3px rgba(248,113,113,0.07)',
    };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentLoginPage() {
    const [tab, setTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    // Login
    const [loginRegNo, setLoginRegNo] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register state
    const [f, setF] = useState({ regNo: '', name: '', gender: '', year: '', department: '', cgpa: '', password: '', confirmPassword: '' });
    const [t, setT] = useState({}); // touched

    const upd = (key, val) => setF(prev => ({ ...prev, [key]: val }));
    const touch = key => setT(prev => ({ ...prev, [key]: true }));
    const touchAll = () => setT({ regNo: true, name: true, gender: true, year: true, department: true, cgpa: true, password: true, confirmPassword: true });

    const isValid = {
        regNo: validate.regNo(f.regNo),
        name: validate.name(f.name),
        cgpa: validate.cgpa(f.cgpa),
        password: validate.password(f.password),
        confirmPassword: validate.confirmPassword(f.confirmPassword, f.password),
        gender: !!f.gender,
        year: !!f.year,
        department: !!f.department,
    };
    const allValid = Object.values(isValid).every(Boolean);
    const completedCount = Object.values(isValid).filter(Boolean).length;
    const totalFields = 8;

    const strength = pwStrength(f.password);
    const sm = strengthMeta[strength];

    function resetMessages() { setError(''); setSuccess(''); }
    function switchTab(tab) { resetMessages(); setT({}); setTab(tab); }

    async function handleLogin(e) {
        e.preventDefault();
        resetMessages();
        const cleaned = loginRegNo.trim();
        if (!cleaned || !loginPassword) { setError('All fields are required.'); return; }
        if (!/^\d{9}$/.test(cleaned)) { setError('Registration number must be exactly 9 digits.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/student/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regNo: cleaned, password: loginPassword }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Login failed.'); return; }
            localStorage.setItem('studentToken', data.token);
            localStorage.setItem('studentData', JSON.stringify(data.student));
            router.push('/student/dashboard');
        } catch { setError('Network error. Try again.'); }
        finally { setLoading(false); }
    }

    async function handleRegister(e) {
        e.preventDefault();
        resetMessages();
        touchAll();
        if (!allValid) { setError('Please fix the highlighted fields before submitting.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/student/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regNo: f.regNo.trim(),
                    name: f.name.trim(),
                    gender: f.gender,
                    year: parseInt(f.year),
                    department: f.department,
                    cgpa: parseFloat(f.cgpa),
                    password: f.password,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Registration failed.'); return; }
            localStorage.setItem('studentToken', data.token);
            localStorage.setItem('studentData', JSON.stringify(data.student));
            setSuccess('Account created! Redirecting to your dashboard...');
            setTimeout(() => router.push('/student/dashboard'), 1400);
        } catch { setError('Network error. Try again.'); }
        finally { setLoading(false); }
    }

    return (
        <div className="s-auth-container" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Background Orbs for glassmorphism pop */}
            <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', background: 'var(--s-teal)', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '300px', height: '300px', background: '#3b82f6', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%', pointerEvents: 'none' }} />

            <div className="s-auth-box s-animate-in" style={{ position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <div className="s-auth-logo">
                    <div style={{ fontSize: '44px', marginBottom: '6px' }}>🏛️</div>
                    <h2>MIT Hostel Portal</h2>
                    <p>Manipal Institute of Technology</p>
                </div>

                {/* Tabs */}
                <div className="s-tabs" style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                    <button className={`s-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')} style={{ fontSize: '15px', padding: '12px' }}>Login</button>
                    <button className={`s-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')} style={{ fontSize: '15px', padding: '12px' }}>Register</button>
                </div>

                {/* ══════════ LOGIN ══════════ */}
                {tab === 'login' && (
                    <div className="s-card" style={{ background: 'linear-gradient(145deg, rgba(26, 34, 52, 0.6) 0%, rgba(10, 15, 26, 0.4) 100%)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '36px 32px' }}>
                        <form onSubmit={handleLogin} noValidate>
                            <div className="s-form-group">
                                <label className="s-label">Registration Number</label>
                                <input
                                    className="s-input"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="9-digit number (e.g. 210905001)"
                                    value={loginRegNo}
                                    onChange={e => setLoginRegNo(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                    autoComplete="username"
                                    maxLength={9}
                                    style={{ letterSpacing: '0.1em', fontWeight: 700 }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--s-text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Exactly 9 digits, numbers only</span>
                                    <span style={{ fontFamily: 'monospace', color: loginRegNo.length === 9 ? '#4ade80' : 'var(--s-text-muted)' }}>{loginRegNo.length}/9</span>
                                </div>
                            </div>
                            <div className="s-form-group">
                                <label className="s-label">Password</label>
                                <input
                                    className="s-input"
                                    type="password"
                                    placeholder="Your password"
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </div>
                            {error && <div className="s-alert s-alert-error">{error}</div>}
                            <button className="s-btn s-btn-primary s-btn-lg" type="submit" disabled={loading}
                                style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>
                                {loading ? <><span className="s-spinner" /> Logging in...</> : '→ Login'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ══════════ REGISTER ══════════ */}
                {tab === 'register' && (
                    <div className="s-card" style={{ background: 'linear-gradient(145deg, rgba(26, 34, 52, 0.6) 0%, rgba(10, 15, 26, 0.4) 100%)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '36px 32px' }}>
                        {/* Progress bar */}
                        <div style={{ marginBottom: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--s-text-muted)' }}>Form progress</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: completedCount === totalFields ? '#4ade80' : 'var(--s-text-muted)' }}>
                                    {completedCount}/{totalFields} fields valid
                                </span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(completedCount / totalFields) * 100}%`, background: 'linear-gradient(90deg, var(--s-teal), #4ade80)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                            </div>
                        </div>

                        <form onSubmit={handleRegister} noValidate>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>

                                {/* Full Name */}
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Full Name</span>
                                        <ValidDot valid={isValid.name} touched={t.name} value={f.name} />
                                    </label>
                                    <input className="s-input" type="text"
                                        placeholder="First and Last name (as per college records)"
                                        value={f.name}
                                        onChange={e => upd('name', e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                        onBlur={() => touch('name')}
                                        style={fieldBorder(isValid.name, t.name, f.name)}
                                        autoComplete="name" />
                                    <FieldError show={t.name && !!f.name && !isValid.name} msg={errors.name} />
                                    {!t.name && <div style={{ fontSize: '11px', color: 'var(--s-text-muted)', marginTop: '4px' }}>{hints.name}</div>}
                                </div>

                                {/* Reg No */}
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Registration Number</span>
                                        <ValidDot valid={isValid.regNo} touched={t.regNo} value={f.regNo} />
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="s-input" type="text" inputMode="numeric"
                                            placeholder="e.g. 210905001"
                                            value={f.regNo}
                                            onChange={e => upd('regNo', e.target.value.replace(/\D/g, '').slice(0, 9))}
                                            onBlur={() => touch('regNo')}
                                            style={{ ...fieldBorder(isValid.regNo, t.regNo, f.regNo), letterSpacing: '0.12em', fontWeight: 700, fontFamily: 'monospace', paddingRight: '52px' }}
                                            maxLength={9} />
                                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: f.regNo.length === 9 ? '#4ade80' : 'var(--s-text-muted)', fontFamily: 'monospace', pointerEvents: 'none' }}>
                                            {f.regNo.length}/9
                                        </span>
                                    </div>
                                    <FieldError show={t.regNo && !!f.regNo && !isValid.regNo} msg={errors.regNo} />
                                    {!t.regNo && <div style={{ fontSize: '11px', color: 'var(--s-text-muted)', marginTop: '4px' }}>{hints.regNo}</div>}
                                </div>

                                {/* Gender */}
                                <div className="s-form-group">
                                    <label className="s-label">Gender</label>
                                    <select className="s-input s-select" value={f.gender}
                                        onChange={e => { upd('gender', e.target.value); touch('gender'); }}>
                                        <option value="">Select...</option>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                    </select>
                                </div>

                                {/* Year */}
                                <div className="s-form-group">
                                    <label className="s-label">Year of Study</label>
                                    <select className="s-input s-select" value={f.year}
                                        onChange={e => { upd('year', e.target.value); touch('year'); }}>
                                        <option value="">Select...</option>
                                        <option value="2">Year 2</option>
                                        <option value="3">Year 3</option>
                                        <option value="4">Year 4</option>
                                    </select>
                                </div>

                                {/* Department */}
                                <div className="s-form-group">
                                    <label className="s-label">Department</label>
                                    <select className="s-input s-select" value={f.department}
                                        onChange={e => { upd('department', e.target.value); touch('department'); }}>
                                        <option value="">Select branch...</option>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                {/* CGPA */}
                                <div className="s-form-group">
                                    <label className="s-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>CGPA</span>
                                        <ValidDot valid={isValid.cgpa} touched={t.cgpa} value={f.cgpa} />
                                    </label>
                                    <input className="s-input" type="text" inputMode="decimal"
                                        placeholder="e.g. 8.75"
                                        value={f.cgpa}
                                        onChange={e => upd('cgpa', e.target.value.replace(/[^0-9.]/g, '').slice(0, 5))}
                                        onBlur={() => touch('cgpa')}
                                        style={fieldBorder(isValid.cgpa, t.cgpa, f.cgpa)} />
                                    <FieldError show={t.cgpa && !!f.cgpa && !isValid.cgpa} msg={errors.cgpa} />
                                    {!t.cgpa && <div style={{ fontSize: '11px', color: 'var(--s-text-muted)', marginTop: '4px' }}>{hints.cgpa}</div>}
                                </div>

                                {/* Password */}
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Password</span>
                                        {f.password && sm && <span style={{ fontSize: '11px', fontWeight: 700, color: sm.color }}>{sm.label}</span>}
                                    </label>
                                    <input className="s-input" type="password"
                                        placeholder="Min 8 chars with a letter and a number"
                                        value={f.password}
                                        onChange={e => upd('password', e.target.value)}
                                        onBlur={() => touch('password')}
                                        style={fieldBorder(isValid.password, t.password, f.password)}
                                        autoComplete="new-password" />
                                    {f.password && (
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                            {[1, 2, 3].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: '3px', borderRadius: '2px',
                                                    background: i <= strength ? (strengthMeta[strength]?.color || '#fff') : 'rgba(255,255,255,0.08)',
                                                    transition: 'background 0.3s',
                                                }} />
                                            ))}
                                        </div>
                                    )}
                                    <FieldError show={t.password && !!f.password && !isValid.password} msg={errors.password} />
                                    {!t.password && <div style={{ fontSize: '11px', color: 'var(--s-text-muted)', marginTop: '4px' }}>{hints.password}</div>}
                                </div>

                                {/* Confirm Password */}
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Confirm Password</span>
                                        <ValidDot valid={isValid.confirmPassword} touched={t.confirmPassword} value={f.confirmPassword} />
                                    </label>
                                    <input className="s-input" type="password"
                                        placeholder="Re-enter your password"
                                        value={f.confirmPassword}
                                        onChange={e => upd('confirmPassword', e.target.value)}
                                        onBlur={() => touch('confirmPassword')}
                                        style={fieldBorder(isValid.confirmPassword, t.confirmPassword, f.confirmPassword)}
                                        autoComplete="new-password" />
                                    <FieldError show={t.confirmPassword && !!f.confirmPassword && !isValid.confirmPassword} msg={errors.confirmPassword} />
                                </div>
                            </div>

                            {/* Security note */}
                            <div style={{ margin: '4px 0 14px', padding: '10px 12px', background: 'rgba(99,209,183,0.04)', border: '1px solid rgba(99,209,183,0.12)', borderRadius: '8px', fontSize: '11px', color: 'var(--s-text-muted)', lineHeight: 1.6 }}>
                                🔒 <strong style={{ color: 'var(--s-text-secondary)' }}>Security:</strong> Passwords are hashed with bcrypt (12 rounds). All inputs are validated and sanitised server-side. Database queries use Prisma's parameterised statements — SQL injection is not possible.
                            </div>

                            {error && <div className="s-alert s-alert-error">{error}</div>}
                            {success && <div className="s-alert s-alert-success">{success}</div>}

                            <button className="s-btn s-btn-primary s-btn-lg" type="submit" disabled={loading}
                                style={{ width: '100%', marginTop: '4px', justifyContent: 'center', transition: 'opacity 0.2s', opacity: allValid ? 1 : 0.7 }}>
                                {loading ? <><span className="s-spinner" /> Creating Account...</> : '🚀 Create Account'}
                            </button>
                        </form>
                    </div>
                )}

                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--s-text-muted)', marginTop: '20px' }}>
                    <a href="/student" style={{ color: 'var(--s-teal)', textDecoration: 'none' }}>← Back to portal home</a>
                </p>
            </div>
        </div>
    );
}
