'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';

export default function UploadPage() {
    const [csvData, setCsvData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [errors, setErrors] = useState([]);
    const [validationResult, setValidationResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [sessionName, setSessionName] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const fileRef = useRef(null);

    function handleFile(file) {
        if (!file || !file.name.endsWith('.csv')) {
            setErrors(['Please upload a .csv file']);
            return;
        }
        setFileName(file.name);
        setErrors([]);
        setValidationResult(null);
        setUploadResult(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    setErrors(results.errors.map(e => `Parse error row ${e.row}: ${e.message}`));
                    return;
                }
                setCsvData(results.data);
                // Auto-generate session name
                const date = new Date().toISOString().split('T')[0];
                setSessionName(`Allotment ${date}`);
            },
        });
    }

    function handleDrop(e) {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }

    async function handleValidate() {
        if (!csvData) return;
        try {
            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: csvData }),
            });
            const data = await res.json();
            setValidationResult(data);
            setErrors(data.errors || []);
        } catch (err) {
            setErrors(['Validation request failed: ' + err.message]);
        }
    }

    async function handleUpload() {
        if (!csvData || !sessionName) return;
        setUploading(true);
        setUploadResult(null);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: csvData, sessionName }),
            });
            const data = await res.json();
            if (data.error) {
                setErrors([data.error]);
            } else {
                setUploadResult(data);
            }
        } catch (err) {
            setErrors(['Upload failed: ' + err.message]);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Upload CSV</h1>
                    <p>Upload student preference data for allotment processing</p>
                </div>
            </div>

            {/* Dropzone */}
            <div
                className={`dropzone ${isDragOver ? 'active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files[0])}
                />
                {fileName ? (
                    <>
                        <h3>✅ {fileName}</h3>
                        <p>{csvData ? `${csvData.length} rows parsed` : 'Parsing...'}</p>
                    </>
                ) : (
                    <>
                        <h3>📁 Drop your CSV file here</h3>
                        <p>or click to browse — supports .csv format</p>
                    </>
                )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="error-list" style={{ marginTop: '20px' }}>
                    <h4>⚠️ {errors.length} Validation Error{errors.length > 1 ? 's' : ''}</h4>
                    <ul>
                        {errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                        {errors.length > 20 && <li>...and {errors.length - 20} more</li>}
                    </ul>
                </div>
            )}

            {/* Preview */}
            {csvData && csvData.length > 0 && (
                <div className="section" style={{ marginTop: '24px' }}>
                    <h2 className="section-title">👁️ Preview ({csvData.length} rows)</h2>
                    <div className="table-container" style={{ maxHeight: '400px', overflow: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    {Object.keys(csvData[0]).map(col => (
                                        <th key={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {csvData.slice(0, 50).map((row, i) => (
                                    <tr key={i}>
                                        {Object.values(row).map((val, j) => (
                                            <td key={j}>{val}</td>
                                        ))}
                                    </tr>
                                ))}
                                {csvData.length > 50 && (
                                    <tr>
                                        <td colSpan={Object.keys(csvData[0]).length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                            ... {csvData.length - 50} more rows
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button className="btn btn-outline" onClick={handleValidate}>
                            ✓ Validate Data
                        </button>

                        {validationResult && validationResult.valid && (
                            <>
                                <input
                                    className="input"
                                    style={{ maxWidth: '280px' }}
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    placeholder="Session name..."
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpload}
                                    disabled={uploading || !sessionName}
                                >
                                    {uploading ? <><span className="spinner" /> Uploading...</> : '🚀 Import to Database'}
                                </button>
                            </>
                        )}
                    </div>

                    {validationResult && validationResult.valid && !uploadResult && (
                        <div className="success-message" style={{ marginTop: '16px' }}>
                            ✅ Validation passed! {validationResult.studentCount} students, {validationResult.groupCount} groups found. Ready to import.
                        </div>
                    )}
                </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
                <div className={uploadResult.warning ? "error-list" : "success-message"} style={{ marginTop: '16px' }}>
                    {uploadResult.warning ? '⚠️' : '✅'} Import complete — Session &ldquo;{uploadResult.sessionName}&rdquo; created.
                    <ul style={{ marginTop: '10px', paddingLeft: '16px', fontSize: '0.9rem' }}>
                        <li>👤 <strong>{uploadResult.studentCount}</strong> students uploaded</li>
                        <li>👥 <strong>{uploadResult.groupCount}</strong> groups created</li>
                        <li>🔗 <strong>{uploadResult.memberCount ?? '?'}</strong> group member links created</li>
                        {uploadResult.groupSkipped > 0 && (
                            <li style={{ color: 'var(--error)' }}>⚠️ {uploadResult.groupSkipped} groups skipped (bad block/room-type in CSV)</li>
                        )}
                        {uploadResult.warning && (
                            <li style={{ color: 'var(--error)' }}>⚠️ {uploadResult.warning}</li>
                        )}
                    </ul>
                    {!uploadResult.warning && (
                        <div style={{ marginTop: '12px' }}>
                            <a href="/admin/allotment" className="btn btn-success btn-sm">
                                ⚡ Go to Allotment
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* CSV Format Reference */}
            <div className="section" style={{ marginTop: '32px' }}>
                <h2 className="section-title">📋 Expected CSV Format</h2>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Example</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['reg_no', 'String', '✅', '210905001'],
                                ['name', 'String', '✅', 'Rahul Sharma'],
                                ['gender', 'M / F', '✅', 'M'],
                                ['year', '2 / 3 / 4', '✅', '3'],
                                ['department', 'String', '✅', 'CSE'],
                                ['cgpa', 'Float (0-10)', '✅', '8.75'],
                                ['roommate_1', 'Reg No', '❌', '210905002'],
                                ['roommate_2', 'Reg No', '❌', '210905003'],
                                ['pref1_block', 'Int', '✅', '14'],
                                ['pref1_room_type', 'Room code', '✅', 'SAC'],
                                ['pref2_block', 'Int', '✅', '18'],
                                ['pref2_room_type', 'Room code', '✅', 'SA'],
                            ].map(([col, type, req, example]) => (
                                <tr key={col}>
                                    <td><code style={{ color: 'var(--accent-primary)' }}>{col}</code></td>
                                    <td>{type}</td>
                                    <td>{req}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{example}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
