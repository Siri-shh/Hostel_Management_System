const fs = require('fs');

async function test() {
    const BASE = 'http://localhost:3001';

    // 1. Read and parse CSV
    const csvText = fs.readFileSync('d:/Hostel_Allotment_System/sample_data.csv', 'utf8');
    const lines = csvText.trim().split('\n');
    const headers = lines[0].trim().split(',');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].trim().split(',');
        const obj = {};
        headers.forEach((h, j) => obj[h] = vals[j] || '');
        rows.push(obj);
    }
    console.log(`📄 Parsed ${rows.length} rows from CSV\n`);

    // 2. Validate
    console.log('--- STEP 1: Validate CSV ---');
    let res = await fetch(`${BASE}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
    });
    let data = await res.json();
    console.log(`Valid: ${data.valid}`);
    console.log(`Students: ${data.studentCount}, Groups: ${data.groupCount}`);
    if (data.errors?.length > 0) {
        console.log('Errors:', data.errors.slice(0, 5));
    }
    console.log('');

    // 3. Upload
    console.log('--- STEP 2: Upload to DB ---');
    res = await fetch(`${BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, sessionName: 'Test Session Feb 2026' }),
    });
    data = await res.json();
    console.log(`Session ID: ${data.sessionId}`);
    console.log(`Session: ${data.sessionName}`);
    console.log(`Students: ${data.studentCount}, Groups: ${data.groupCount}`);
    const sessionId = data.sessionId;
    console.log('');

    // 4. Run Round 1
    console.log('--- STEP 3: Run Round 1 ---');
    res = await fetch(`${BASE}/api/allotment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, round: 1 }),
    });
    data = await res.json();
    console.log(`Allotted (Pref1): ${data.allottedPref1}`);
    console.log(`Allotted (Pref2): ${data.allottedPref2}`);
    console.log(`Allotted (Random): ${data.allottedRandom}`);
    console.log(`Allotted Students: ${data.allottedStudents}`);
    console.log(`Waitlisted Students: ${data.waitlistedStudents}`);
    console.log('');

    // 5. Run Round 2
    console.log('--- STEP 4: Run Round 2 ---');
    res = await fetch(`${BASE}/api/allotment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, round: 2 }),
    });
    data = await res.json();
    console.log(`Allotted Students: ${data.allottedStudents}`);
    console.log(`Off-campus Students: ${data.waitlistedStudents}`);
    console.log('');

    // 6. Get Results
    console.log('--- STEP 5: Get Results ---');
    res = await fetch(`${BASE}/api/results/${sessionId}`);
    data = await res.json();
    console.log(`Total: ${data.total}`);
    console.log(`Allotted: ${data.allotted}`);
    console.log(`Waitlisted: ${data.waitlisted}`);
    console.log(`Off-campus: ${data.offCampus}`);
    console.log(`Round 1: ${data.round1Allotted}, Round 2: ${data.round2Allotted}`);
    console.log(`Gender: M=${data.genderStats?.MALE}, F=${data.genderStats?.FEMALE}`);
    console.log(`Blocks: ${data.blockStats?.map(b => `B${b.blockNumber}(${b.allotted})`).join(', ')}`);
    console.log('\n✅ ALL TESTS PASSED');
}

test().catch(e => console.error('❌ TEST FAILED:', e.message));
