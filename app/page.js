'use client';

import Link from 'next/link';
import { useState } from 'react';
import './home.css';

const FAQ_DATA = [
    {
        q: 'Who is eligible for hostel allotment?',
        a: 'All BTech students of Manipal Institute of Technology currently enrolled in Year 2, Year 3, or Year 4 are eligible. First-year students are allotted separate blocks (Blocks 1–7, 9, 11, 12, 16, 17) and are not part of this system.',
    },
    {
        q: 'Can I choose my roommate?',
        a: 'Yes! You can apply with up to 2 roommates (forming a group of 2 or 3). All roommates must be the same gender. If you apply solo but choose a Double or Quadruple room, you will be randomly paired with other solo applicants who chose the same block and room type.',
    },
    {
        q: 'How is CGPA calculated for a group?',
        a: 'For solo applicants, their individual CGPA is used. For groups, the average CGPA of all members is calculated. For example, if a pair has CGPAs of 8.4 and 9.0, their group CGPA is (8.4 + 9.0) / 2 = 8.7. This averaged CGPA determines their priority in the allotment queue.',
    },
    {
        q: 'What happens if both my preferences are full?',
        a: 'After preference-based allocation, if both your Preference 1 and Preference 2 blocks/room types are fully occupied, the system will attempt to place you in any available room across all blocks that matches your gender and group size. This random assignment is still done in CGPA order. If no room is available at all after Round 1, you are waitlisted.',
    },
    {
        q: 'What is the difference between Round 1 and Round 2?',
        a: 'Round 1 processes all students — it tries your preferences first, then random vacancies. Students who cannot be placed in Round 1 are waitlisted. Round 2 takes the waitlisted students and runs the same algorithm using whatever rooms remain. Students who still cannot be placed after Round 2 are marked as off-campus.',
    },
    {
        q: 'Can a solo student apply for a Double room?',
        a: 'Yes. A solo student can choose any room type (Single, Double, or Quadruple). If you choose a Double room as a solo applicant, the system will try to pair you with another solo applicant who also chose the same block and room type. If no match is found, you will still be assigned the room with one bed vacant.',
    },
    {
        q: 'Can I choose my specific room number?',
        a: 'No. You can only choose your preferred Block and Room Type (e.g., Block 14, SAC). The specific room number within that block is assigned by the system sequentially (floor 1 first, then floor 2, etc.).',
    },
    {
        q: 'What room types are available?',
        a: 'There are 7 room types: SA (Single Attached Non-AC), SAC (Single Attached AC), SC (Single Non-Attached Non-AC), DA (Double Attached Non-AC), DAC (Double Attached AC), DC (Double Non-Attached Non-AC), and QAC (Quadruple Attached AC). "Attached" means the room has its own private washroom.',
    },
    {
        q: 'How do I submit my preferences?',
        a: 'Currently, preferences are submitted via a CSV file uploaded by the hostel administration. The CSV contains your registration number, name, gender, year, department, CGPA, roommate details (if any), and two preferences — each consisting of a Block number and Room Type code. In the future, a student portal will allow you to submit preferences directly online.',
    },
    {
        q: 'Is the allotment final or can it change?',
        a: 'Once both rounds are complete, the allotment results are saved to the database and can be viewed or exported. In the current MVP, manual overrides and room swap requests are planned as future features. Contact the hostel administration for any post-allotment changes.',
    },
];

export default function Home() {
    const [openFaq, setOpenFaq] = useState(null);

    return (
        <div className="home-container">
            {/* Animated background */}
            <div className="home-bg">
                <div className="home-bg-orb orb-1"></div>
                <div className="home-bg-orb orb-2"></div>
                <div className="home-bg-orb orb-3"></div>
            </div>

            <div className="home-content">
                {/* Header */}
                <div className="home-header">
                    <div className="home-logo">🏠</div>
                    <h1 className="home-title">MIT Hostel Allotment System</h1>
                    <p className="home-subtitle">Manipal Institute of Technology</p>
                    <p className="home-desc">
                        Streamlined hostel room allotment powered by CGPA-based allocation.
                        Select your portal to continue.
                    </p>
                </div>

                {/* Portal Cards */}
                <div className="portal-grid">
                    {/* Admin Portal */}
                    <Link href="/admin" className="portal-card portal-admin">
                        <div className="portal-icon-wrap admin-icon-wrap">
                            <span className="portal-icon">🛡️</span>
                        </div>
                        <h2 className="portal-title">Admin Portal</h2>
                        <p className="portal-desc">
                            Manage hostel blocks, upload student data, run the allotment algorithm, and view results.
                        </p>
                        <div className="portal-action">
                            Enter Dashboard <span className="portal-arrow">→</span>
                        </div>
                    </Link>

                    {/* Student Portal */}
                    <div className="portal-card portal-student disabled">
                        <div className="portal-icon-wrap student-icon-wrap">
                            <span className="portal-icon">🎓</span>
                        </div>
                        <h2 className="portal-title">Student Portal</h2>
                        <p className="portal-desc">
                            Apply for hostel rooms, choose roommates, and set your block preferences.
                        </p>
                        <div className="portal-maintenance">
                            <span className="maintenance-badge">🔧 Under Maintenance</span>
                            <p>Coming soon — this portal is currently being developed.</p>
                        </div>
                    </div>
                </div>

                {/* ===================== INFO SECTIONS ===================== */}

                {/* --- Eligibility --- */}
                <section className="info-section" id="eligibility">
                    <div className="info-section-icon">📋</div>
                    <h2 className="info-section-title">Eligibility Criteria</h2>
                    <p className="info-section-subtitle">Who can apply for hostel room allotment?</p>

                    <div className="info-cards-row">
                        <div className="info-card">
                            <div className="info-card-icon green-bg">✅</div>
                            <h4>Eligible</h4>
                            <ul>
                                <li>BTech students of MIT, Manipal</li>
                                <li>Currently enrolled in <strong>Year 2, Year 3, or Year 4</strong></li>
                                <li>Must have a valid CGPA on record</li>
                                <li>Must not be under any disciplinary suspension</li>
                            </ul>
                        </div>
                        <div className="info-card">
                            <div className="info-card-icon red-bg">✕</div>
                            <h4>Not Eligible</h4>
                            <ul>
                                <li>First-year students (allotted separately to Blocks 1–7, 9, 11, 12, 16, 17)</li>
                                <li>Students with pending hostel dues from previous semesters</li>
                                <li>Students who have opted for day-scholar status</li>
                            </ul>
                        </div>
                    </div>

                    <div className="info-note">
                        <span className="info-note-icon">ℹ️</span>
                        <p><strong>Gender-separated blocks:</strong> Boys can only be allotted to Blocks 10, 14, 15, 18, 19, 20, 23. Girls can only be allotted to Blocks 8, 13, 21, 22. The system automatically enforces this.</p>
                    </div>
                </section>

                {/* --- How It Works --- */}
                <section className="info-section" id="how-it-works">
                    <div className="info-section-icon">⚡</div>
                    <h2 className="info-section-title">How It Works</h2>
                    <p className="info-section-subtitle">The allotment process in 3 simple steps</p>

                    <div className="steps-flow">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <h4>Submit Preferences</h4>
                            <p>Fill in your details and choose two preferences. Each preference is a combination of a <strong>Block</strong> and a <strong>Room Type</strong>. You can optionally add up to 2 roommates.</p>
                        </div>
                        <div className="step-connector">→</div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h4>Algorithm Runs</h4>
                            <p>The system sorts all students/groups by <strong>CGPA</strong> (highest first) and assigns rooms based on preference availability. Two rounds are run to maximize placements.</p>
                        </div>
                        <div className="step-connector">→</div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <h4>View Results</h4>
                            <p>After allotment, view your assigned <strong>Block, Room Type, and Room Number</strong>. Results include visual stats, exportable CSV, and full transparency.</p>
                        </div>
                    </div>
                </section>

                {/* --- Preference Form Guide --- */}
                <section className="info-section" id="preferences">
                    <div className="info-section-icon">📝</div>
                    <h2 className="info-section-title">How to Fill Your Preferences</h2>
                    <p className="info-section-subtitle">Each student must provide the following information</p>

                    <div className="form-guide">
                        <div className="form-guide-table">
                            <div className="fg-row fg-header">
                                <span>Field</span><span>Description</span><span>Example</span>
                            </div>
                            <div className="fg-row"><span>Registration No.</span><span>Your unique MIT registration number</span><span className="fg-mono">210905001</span></div>
                            <div className="fg-row"><span>Full Name</span><span>As per college records</span><span className="fg-mono">Rahul Sharma</span></div>
                            <div className="fg-row"><span>Gender</span><span>M (Male) or F (Female)</span><span className="fg-mono">M</span></div>
                            <div className="fg-row"><span>Year</span><span>Current year of study (2, 3, or 4)</span><span className="fg-mono">3</span></div>
                            <div className="fg-row"><span>Department</span><span>Branch abbreviation</span><span className="fg-mono">CSE</span></div>
                            <div className="fg-row"><span>CGPA</span><span>Cumulative GPA (0.0 – 10.0)</span><span className="fg-mono">8.75</span></div>
                            <div className="fg-row fg-highlight"><span>Roommate 1</span><span>Reg. no. of your first roommate (optional)</span><span className="fg-mono">210905002</span></div>
                            <div className="fg-row fg-highlight"><span>Roommate 2</span><span>Reg. no. of your second roommate (optional)</span><span className="fg-mono">—</span></div>
                            <div className="fg-row fg-pref"><span>Preference 1: Block</span><span>Block number for your first choice</span><span className="fg-mono">14</span></div>
                            <div className="fg-row fg-pref"><span>Preference 1: Room Type</span><span>Room type code for your first choice</span><span className="fg-mono">SAC</span></div>
                            <div className="fg-row fg-pref"><span>Preference 2: Block</span><span>Block number for your second choice</span><span className="fg-mono">18</span></div>
                            <div className="fg-row fg-pref"><span>Preference 2: Room Type</span><span>Room type code for your second choice</span><span className="fg-mono">SA</span></div>
                        </div>
                    </div>

                    <div className="info-note" style={{ marginTop: '20px' }}>
                        <span className="info-note-icon">💡</span>
                        <p><strong>Tip:</strong> If you apply with a roommate, both of you must list each other's registration number. Your CGPAs will be averaged, and you will be allotted to the same room together. Make sure your roommate's chosen preferences are compatible with your group size (e.g., a pair cannot choose a Single room).</p>
                    </div>
                </section>

                {/* --- Available Room Types --- */}
                <section className="info-section" id="room-types">
                    <div className="info-section-icon">🏢</div>
                    <h2 className="info-section-title">Available Room Types & Blocks</h2>
                    <p className="info-section-subtitle">7 room types across 11 in-scope blocks</p>

                    <div className="room-type-grid">
                        {[
                            { code: 'SA', name: 'Single Attached Non-AC', cap: 1, desc: 'Private room with attached washroom, no air conditioning.', blocks: '13, 18, 19, 20, 21' },
                            { code: 'SAC', name: 'Single Attached AC', cap: 1, desc: 'Private room with attached washroom and air conditioning.', blocks: '10, 13, 14, 15, 18, 19, 20, 21, 23' },
                            { code: 'SC', name: 'Single Non-Attached Non-AC', cap: 1, desc: 'Private room with shared/common washroom, no AC.', blocks: '10' },
                            { code: 'DA', name: 'Double Attached Non-AC', cap: 2, desc: 'Shared room for 2 with attached washroom, no AC.', blocks: '8, 13' },
                            { code: 'DAC', name: 'Double Attached AC', cap: 2, desc: 'Shared room for 2 with attached washroom and AC.', blocks: '8, 13, 14, 15, 22, 23' },
                            { code: 'DC', name: 'Double Non-Attached Non-AC', cap: 2, desc: 'Shared room for 2 with shared/common washroom, no AC.', blocks: '10' },
                            { code: 'QAC', name: 'Quadruple Attached AC', cap: 4, desc: 'Shared room for 4 with attached washroom and AC.', blocks: '23' },
                        ].map(rt => (
                            <div key={rt.code} className="rt-card">
                                <div className="rt-card-header">
                                    <span className="rt-code">{rt.code}</span>
                                    <span className="rt-cap">{rt.cap} {rt.cap === 1 ? 'bed' : 'beds'}</span>
                                </div>
                                <h4 className="rt-name">{rt.name}</h4>
                                <p className="rt-desc">{rt.desc}</p>
                                <div className="rt-blocks">
                                    <span className="rt-blocks-label">Available in:</span> Block {rt.blocks}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* --- Allotment Algorithm Explained --- */}
                <section className="info-section" id="algorithm">
                    <div className="info-section-icon">🧠</div>
                    <h2 className="info-section-title">The Allotment Algorithm — Explained</h2>
                    <p className="info-section-subtitle">A transparent, CGPA-based allocation process</p>

                    <div className="algo-steps">
                        <div className="algo-step">
                            <div className="algo-step-num">Step 1</div>
                            <div className="algo-step-content">
                                <h4>Group Formation</h4>
                                <p>Students who listed each other as roommates are grouped together (solo, pair, or triple). Each group's CGPA is the <strong>average</strong> of all members' individual CGPAs.</p>
                            </div>
                        </div>
                        <div className="algo-step">
                            <div className="algo-step-num">Step 2</div>
                            <div className="algo-step-content">
                                <h4>CGPA Sorting</h4>
                                <p>All groups are sorted by their average CGPA in <strong>descending order</strong>. The group with the highest CGPA gets allocated first.</p>
                            </div>
                        </div>
                        <div className="algo-step">
                            <div className="algo-step-num">Step 3</div>
                            <div className="algo-step-content">
                                <h4>Preference-Based Allocation (Round 1)</h4>
                                <p>For each group (highest CGPA first), the system tries: <strong>Preference 1</strong> → <strong>Preference 2</strong> → <strong>Any random vacant room</strong> matching the student's gender and group size. If no room is available at all, the group is <strong>waitlisted</strong>.</p>
                            </div>
                        </div>
                        <div className="algo-step">
                            <div className="algo-step-num">Step 4</div>
                            <div className="algo-step-content">
                                <h4>Waitlisted Students (Round 2)</h4>
                                <p>Waitlisted groups go through the exact same process using remaining rooms. Groups that still can't be placed are marked <strong>off-campus</strong>.</p>
                            </div>
                        </div>
                    </div>

                    {/* Worked Example */}
                    <div className="example-box">
                        <h4 className="example-title">📌 Worked Example</h4>
                        <p className="example-desc">Suppose we have the following 3 groups applying:</p>

                        <div className="example-table">
                            <div className="ex-row ex-header">
                                <span>Group</span><span>Members</span><span>Avg CGPA</span><span>Pref 1</span><span>Pref 2</span>
                            </div>
                            <div className="ex-row">
                                <span>A</span><span>Rahul (9.2) + Aman (8.8)</span><span className="ex-highlight">9.0</span><span>Block 14, DAC</span><span>Block 15, SAC</span>
                            </div>
                            <div className="ex-row">
                                <span>B</span><span>Karan (solo)</span><span className="ex-highlight">9.5</span><span>Block 14, DAC</span><span>Block 23, SAC</span>
                            </div>
                            <div className="ex-row">
                                <span>C</span><span>Sid (8.7) + Nik (8.3) + Pranav (8.9)</span><span className="ex-highlight">8.63</span><span>Block 23, QAC</span><span>Block 14, DAC</span>
                            </div>
                        </div>

                        <div className="example-walkthrough">
                            <p><strong>Processing order</strong> (by CGPA): B (9.5) → A (9.0) → C (8.63)</p>
                            <div className="ew-step">
                                <span className="ew-badge green">B → Pref 1 ✅</span>
                                <p>Karan (solo, CGPA 9.5) gets <strong>Block 14, DAC</strong>. Since he is solo in a double room, one bed remains vacant for a future solo applicant to fill.</p>
                            </div>
                            <div className="ew-step">
                                <span className="ew-badge green">A → Pref 1 ✅</span>
                                <p>Rahul + Aman (pair, avg 9.0) get <strong>Block 14, DAC</strong>. The system assigns them a different DAC room (not the one Karan is in, since that only has 1 vacant bed and they need 2). They get a fresh empty room.</p>
                            </div>
                            <div className="ew-step">
                                <span className="ew-badge green">C → Pref 1 ✅</span>
                                <p>Sid + Nik + Pranav (triple, avg 8.63) get <strong>Block 23, QAC</strong>. Since QAC fits 4 and they are 3, one bed remains vacant in the room.</p>
                            </div>
                        </div>

                        <div className="info-note" style={{ marginTop: '16px' }}>
                            <span className="info-note-icon">🎯</span>
                            <p>In this example, all groups got their Preference 1. In real scenarios with thousands of students, lower-CGPA groups may fall through to Preference 2, random assignment, or the waitlist.</p>
                        </div>
                    </div>
                </section>

                {/* --- FAQs --- */}
                <section className="info-section" id="faqs">
                    <div className="info-section-icon">❓</div>
                    <h2 className="info-section-title">Frequently Asked Questions</h2>
                    <p className="info-section-subtitle">Everything you need to know</p>

                    <div className="faq-list">
                        {FAQ_DATA.map((faq, i) => (
                            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                    <span className="faq-q-text">{faq.q}</span>
                                    <span className={`faq-chevron ${openFaq === i ? 'rotated' : ''}`}>▼</span>
                                </button>
                                {openFaq === i && (
                                    <div className="faq-answer animate-in">
                                        <p>{faq.a}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer */}
                <div className="home-footer">
                    <p>© 2026 Manipal Institute of Technology — Hostel Allotment System v1.0</p>
                </div>
            </div>
        </div>
    );
}
