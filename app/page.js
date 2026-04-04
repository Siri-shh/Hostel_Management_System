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
        a: 'Preferences are submitted directly through the Student Portal on this website. Register using your registration number, then log in to form a group or apply solo. The group leader selects two preferences (Block + Room Type). Once you submit and lock your preferences, they are saved and processed when the admin runs the allotment. The portal can only be used during the OPEN window — once the admin locks it, no further changes are possible.',
    },
    {
        q: 'Is the allotment final or can it change?',
        a: 'Once both rounds are complete, the allotment results are saved and visible in the Student Portal. The admin has a verification window between Round 1 and Round 2 to manually disallow any allotment (e.g., due to dues or disciplinary issues), which frees that room for Round 2. After Round 2 is finalised, results are permanent. Contact the hostel office for any exceptional post-allotment requests.',
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
                    <Link href="/student" className="portal-card portal-student">
                        <div className="portal-icon-wrap student-icon-wrap">
                            <span className="portal-icon">🎓</span>
                        </div>
                        <h2 className="portal-title">Student Portal</h2>
                        <p className="portal-desc">
                            Apply for hostel rooms, form your group, set block preferences, and check your allotment results.
                        </p>
                        <div className="portal-action">
                            Enter Portal <span className="portal-arrow">→</span>
                        </div>
                    </Link>
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
                            <h4>Register &amp; Submit via Portal</h4>
                            <p>Log in to the <strong>Student Portal</strong>, form a group with up to 2 friends using an invite code, and have your group leader select two preferences — each is a <strong>Block</strong> and <strong>Room Type</strong> combination.</p>
                        </div>
                        <div className="step-connector">→</div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h4>Algorithm Runs</h4>
                            <p>Groups are sorted by <strong>average CGPA</strong> (highest first). Year of study acts as a tiebreaker (Year 2 &gt; Year 3 &gt; Year 4). Two rounds run to maximise placements across all blocks.</p>
                        </div>
                        <div className="step-connector">→</div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <h4>View Results</h4>
                            <p>After allotment, view your assigned <strong>Block, Room Type, and Room Number</strong>. Results include visual stats, exportable CSV, and full transparency.</p>
                        </div>
                    </div>
                </section>

                {/* --- Preference & Portal Guide --- */}
                <section className="info-section" id="preferences">
                    <div className="info-section-icon">📝</div>
                    <h2 className="info-section-title">How to Use the Student Portal</h2>
                    <p className="info-section-subtitle">Submit your preferences in 4 simple steps via the online portal</p>

                    <div className="form-guide">
                        <div className="form-guide-table">
                            <div className="fg-row fg-header">
                                <span>Step</span><span>Action</span><span>Notes</span>
                            </div>
                            <div className="fg-row fg-pref"><span>1 — Register</span><span>Visit the Student Portal and create an account using your 9-digit reg. no., name, gender, year, department, and CGPA.</span><span className="fg-mono">Only if portal is OPEN</span></div>
                            <div className="fg-row fg-highlight"><span>2 — Form Group</span><span>Create a group and share your invite code with up to 2 friends. All members must be the same gender. You can also apply solo.</span><span className="fg-mono">Max 3 members</span></div>
                            <div className="fg-row fg-highlight"><span>3 — Set Preferences</span><span>As group leader, choose Preference 1 (Block + Room Type) and Preference 2. Room type capacity must fit your group size.</span><span className="fg-mono">Leader only</span></div>
                            <div className="fg-row fg-pref"><span>4 — Lock &amp; Submit</span><span>Click "Submit &amp; Lock Preferences". Once locked, no further changes can be made — your application enters the allotment queue.</span><span className="fg-mono">Irreversible</span></div>
                        </div>
                    </div>

                    <div className="info-note" style={{ marginTop: '20px' }}>
                        <span className="info-note-icon">💡</span>
                        <p><strong>Important:</strong> All group members must register individually. The group's priority score is the <strong>average CGPA</strong> of all members. Make sure your selected room type capacity is large enough for your group — a pair (2 students) cannot choose a Single room, and a triple (3 students) needs at minimum a room with capacity ≥ 3.</p>
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
                                <h4>Priority Sorting</h4>
                                <p>All groups are sorted by <strong>average CGPA descending</strong>. When two groups have the same CGPA, the one with a lower year of study wins (<em>Year 2 &gt; Year 3 &gt; Year 4</em>). The highest-priority group is allocated first.</p>
                            </div>
                        </div>
                        <div className="algo-step">
                            <div className="algo-step-num">Step 3</div>
                            <div className="algo-step-content">
                                <h4>Allocation Round 1</h4>
                                <p>For each group (priority order), the system tries: <strong>Pref 1</strong> → <strong>Pref 2</strong>. In <em>Smart Vacancy</em> mode, it also searches all remaining compatible rooms (prioritising popular blocks first). Groups that still cannot be placed are <strong>waitlisted</strong>.</p>
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
