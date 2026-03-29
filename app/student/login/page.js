'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEPARTMENTS = [
    'AE', 'AT', 'BT', 'CE', 'CH', 'CHE', 'CS', 'CSE', 'CSBS', 'CV', 'DS',
    'EC', 'ECE', 'EE', 'EEE', 'EI', 'ENI', 'ICE', 'IE', 'IS', 'IT',
    'IM', 'MA', 'ME', 'MT', 'PE', 'PH', 'PI', 'TT',
];

export default function StudentLoginPage() {
    const [tab, setTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    // Login fields
    const [loginRegNo, setLoginRegNo] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register fields
    const [regNo, setRegNo] = useState('');
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [year, setYear] = useState('');
    const [department, setDepartment] = useState('');
    const [cgpa, setCgpa] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    function resetMessages() { setError(''); setSuccess(''); }
    function switchTab(t) { setTab(t); resetMessages(); }

    async function handleLogin(e) {
        e.preventDefault();
        resetMessages();
        if (!loginRegNo.trim() || !loginPassword) { setError('All fields required.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/student/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regNo: loginRegNo.trim().toUpperCase(), password: loginPassword }),
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
        if (!regNo || !name || !gender || !year || !department || !cgpa || !password || !confirmPassword) {
            setError('All fields are required.'); return;
        }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        const cgpaNum = parseFloat(cgpa);
        if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) { setError('Enter a valid CGPA (0 – 10).'); return; }

        setLoading(true);
        try {
            const res = await fetch('/api/student/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    regNo: regNo.trim().toUpperCase(),
                    name: name.trim(),
                    gender,
                    year: parseInt(year),
                    department,
                    cgpa: cgpaNum,
                    password,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Registration failed.'); return; }
            localStorage.setItem('studentToken', data.token);
            localStorage.setItem('studentData', JSON.stringify(data.student));
            setSuccess('Account created! Redirecting...');
            setTimeout(() => router.push('/student/dashboard'), 1200);
        } catch { setError('Network error. Try again.'); }
        finally { setLoading(false); }
    }

    return (
        <div className="s-auth-container">
            <div className="s-auth-box s-animate-in">
                <div className="s-auth-logo">
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏛️</div>
                    <h2>MIT Hostel Portal</h2>
                    <p>Manipal Institute of Technology</p>
                </div>

                <div className="s-tabs">
                    <button className={`s-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Login</button>
                    <button className={`s-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Register</button>
                </div>

                {/* ===== LOGIN ===== */}
                {tab === 'login' && (
                    <div className="s-card">
                        <form onSubmit={handleLogin}>
                            <div className="s-form-group">
                                <label className="s-label">Registration Number</label>
                                <input className="s-input" type="text" placeholder="e.g. 210905001" value={loginRegNo}
                                    onChange={e => setLoginRegNo(e.target.value)} autoCapitalize="characters" autoComplete="username" />
                            </div>
                            <div className="s-form-group">
                                <label className="s-label">Password</label>
                                <input className="s-input" type="password" placeholder="Your password" value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
                            </div>
                            {error && <div className="s-alert s-alert-error">{error}</div>}
                            <button className="s-btn s-btn-primary s-btn-lg" type="submit" disabled={loading}
                                style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>
                                {loading ? <><span className="s-spinner" /> Logging in...</> : '→ Login'}
                            </button>
                        </form>
                    </div>
                )}

                {/* ===== REGISTER ===== */}
                {tab === 'register' && (
                    <div className="s-card">
                        <div className="s-alert s-alert-info" style={{ marginTop: 0, marginBottom: '18px', fontSize: '13px' }}>
                            📋 Enter your actual student details. Your CGPA determines your allotment priority.
                        </div>
                        <form onSubmit={handleRegister}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label">Full Name</label>
                                    <input className="s-input" type="text" placeholder="As per college records" value={name}
                                        onChange={e => setName(e.target.value)} autoComplete="name" />
                                </div>
                                <div className="s-form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="s-label">Registration Number</label>
                                    <input className="s-input" type="text" placeholder="e.g. 210905001" value={regNo}
                                        onChange={e => setRegNo(e.target.value)} autoCapitalize="characters" autoComplete="username"
                                        style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">Gender</label>
                                    <select className="s-input s-select" value={gender} onChange={e => setGender(e.target.value)}>
                                        <option value="">Select...</option>
                                        <option value="MALE">Male</option>
                                        <option value="FEMALE">Female</option>
                                    </select>
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">Year of Study</label>
                                    <select className="s-input s-select" value={year} onChange={e => setYear(e.target.value)}>
                                        <option value="">Select...</option>
                                        <option value="2">Year 2</option>
                                        <option value="3">Year 3</option>
                                        <option value="4">Year 4</option>
                                    </select>
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">Department</label>
                                    <select className="s-input s-select" value={department} onChange={e => setDepartment(e.target.value)}>
                                        <option value="">Select...</option>
                                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">CGPA</label>
                                    <input className="s-input" type="number" step="0.01" min="0" max="10"
                                        placeholder="e.g. 8.75" value={cgpa} onChange={e => setCgpa(e.target.value)} />
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">Password</label>
                                    <input className="s-input" type="password" placeholder="Min 6 characters" value={password}
                                        onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                                </div>
                                <div className="s-form-group">
                                    <label className="s-label">Confirm Password</label>
                                    <input className="s-input" type="password" placeholder="Re-enter password" value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                                </div>
                            </div>
                            {error && <div className="s-alert s-alert-error">{error}</div>}
                            {success && <div className="s-alert s-alert-success">{success}</div>}
                            <button className="s-btn s-btn-primary s-btn-lg" type="submit" disabled={loading}
                                style={{ width: '100%', marginTop: '4px', justifyContent: 'center' }}>
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
