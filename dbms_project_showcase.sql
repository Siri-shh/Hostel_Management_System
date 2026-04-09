-- =====================================================================
-- HOSTEL ALLOTMENT SYSTEM - FULL DBMS QUERY MANIFEST
-- Database Provider: PostgreSQL (Neon)
--
-- HOW TO USE IN NEON SQL EDITOR:
--   - Run the file in sections (highlight a block, then click Run)
--   - Part 1: SCHEMA OBJECTS (Views, Triggers, etc.) — run once first
--   - Parts 2-4 use BEGIN/ROLLBACK blocks — they execute fully but
--     do NOT permanently change any data. Perfect for live demos.
-- =====================================================================

-- =====================================================================
-- PART 1: SCHEMA OBJECTS (Safe to run; creates database-level objects)
-- =====================================================================

-- ---- 1A. VIEW: Live Room Vacancy Monitor ----
-- Joins 4 tables to calculate occupied vs vacant beds per room.
CREATE OR REPLACE VIEW vw_room_vacancies AS
SELECT
    b.number            AS block_number,
    b.gender            AS block_gender,
    r."roomNumber",
    r.floor,
    rt.name             AS room_type,
    rt.capacity         AS total_capacity,
    COALESCE(COUNT(a.id), 0)                        AS occupied_beds,
    (rt.capacity - COALESCE(COUNT(a.id), 0))        AS vacant_beds
FROM rooms r
JOIN blocks       b  ON r."blockId"    = b.id
JOIN room_types   rt ON r."roomTypeId" = rt.id
LEFT JOIN allotments a ON a."roomId" = r.id AND a.status = 'ALLOTTED'
GROUP BY b.number, b.gender, r."roomNumber", r.floor, rt.name, rt.capacity;

-- Usage (run separately):
-- SELECT * FROM vw_room_vacancies WHERE vacant_beds > 0 ORDER BY block_number;


-- ---- 1B. TRIGGER: Session Status Audit Log ----
-- Automatically logs every session status change (DRAFT → OPEN → LOCKED).

CREATE TABLE IF NOT EXISTS session_audit_log (
    id          SERIAL PRIMARY KEY,
    "sessionId" INTEGER      NOT NULL,
    old_status  VARCHAR(50),
    new_status  VARCHAR(50),
    changed_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION log_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO session_audit_log ("sessionId", old_status, new_status)
        VALUES (OLD.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_session_status ON allotment_sessions;
CREATE TRIGGER trg_session_status
AFTER UPDATE ON allotment_sessions
FOR EACH ROW EXECUTE FUNCTION log_session_status_change();


-- ---- 1C. STORED PROCEDURE: Hard Reset a Session ----
-- Atomically deletes all allotments and resets session status to DRAFT.

CREATE OR REPLACE PROCEDURE proc_reset_session_allotments(target_session_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM allotments WHERE "sessionId" = target_session_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    UPDATE allotment_sessions SET status = 'DRAFT' WHERE id = target_session_id;
    RAISE NOTICE 'Reset complete. % allotment rows deleted for session %.', deleted_count, target_session_id;
END;
$$;

-- Usage (run separately):
-- CALL proc_reset_session_allotments((SELECT MAX(id) FROM allotment_sessions));


-- ---- 1D. CURSOR FUNCTION: Waitlist Report (CGPA order) ----
-- Iterates through waitlisted students row-by-row to build a ranked text report.

CREATE OR REPLACE FUNCTION generate_waitlist_report(target_session_id INT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    waitlist_cursor CURSOR FOR
        SELECT s.name, s."regNo", s.cgpa
        FROM allotments a
        JOIN students s ON a."studentId" = s.id
        WHERE a."sessionId" = target_session_id AND a.status = 'WAITLISTED'
        ORDER BY s.cgpa DESC;
    rec         RECORD;
    report      TEXT := e'--- WAITLIST REPORT ---\n';
    row_rank    INT  := 1;
BEGIN
    OPEN waitlist_cursor;
    LOOP
        FETCH waitlist_cursor INTO rec;
        EXIT WHEN NOT FOUND;
        report := report || row_rank || '. ' || rec.name
                         || ' (' || rec."regNo" || ') — CGPA: '
                         || rec.cgpa || e'\n';
        row_rank := row_rank + 1;
    END LOOP;
    CLOSE waitlist_cursor;
    RETURN report;
END;
$$;

-- Usage (run separately):
-- SELECT generate_waitlist_report((SELECT MAX(id) FROM allotment_sessions));


-- =====================================================================
-- PART 2: READ-ONLY SELECT QUERIES (Show real data; safe to run anytime)
-- =====================================================================

-- ---- 2A. Block overview: Room type breakdown per block ----
SELECT b.number AS block, b.gender, rt.name AS room_type, brc."roomsPerFloor"
FROM blocks b
JOIN block_room_configs brc ON b.id = brc."blockId"
JOIN room_types rt          ON brc."roomTypeId" = rt.id
ORDER BY b.number, rt.name;


-- ---- 2B. Aggregate: Rooms per block (total count and capacity) ----
SELECT b.number AS block, b.gender, COUNT(r.id) AS total_rooms, SUM(rt.capacity) AS total_beds
FROM blocks b
JOIN rooms r      ON r."blockId" = b.id
JOIN room_types rt ON r."roomTypeId" = rt.id
GROUP BY b.number, b.gender
ORDER BY b.number;


-- ---- 2C. All active sessions with student & group counts ----
SELECT
    s.id, s.name, s.status, s."portalStatus",
    (SELECT COUNT(*) FROM students      st WHERE st."sessionId" = s.id) AS student_count,
    (SELECT COUNT(*) FROM student_groups sg WHERE sg."sessionId" = s.id) AS group_count,
    (SELECT COUNT(*) FROM allotments     a  WHERE a."sessionId"  = s.id) AS allotment_count
FROM allotment_sessions s
ORDER BY s."createdAt" DESC;


-- ---- 2D. Student sample: First 10 students in latest session ----
SELECT "regNo", name, gender, year, department, cgpa, source
FROM students
WHERE "sessionId" = (SELECT MAX(id) FROM allotment_sessions)
ORDER BY cgpa DESC
LIMIT 10;


-- ---- 2E. Department-wise CGPA aggregation ----
SELECT department, COUNT(*) AS student_count, ROUND(AVG(cgpa)::numeric, 2) AS avg_cgpa, MAX(cgpa) AS top_cgpa
FROM students
WHERE "sessionId" = (SELECT MAX(id) FROM allotment_sessions)
GROUP BY department
ORDER BY avg_cgpa DESC;


-- ---- 2F. Use the View: Show rooms with vacancies ----
SELECT * FROM vw_room_vacancies
ORDER BY block_number, "roomNumber"
LIMIT 20;


-- ---- 2G. Block occupancy report (from allotments) ----
-- Shows avg CGPA of allotted students per block. Returns 0 rows if no allotments yet.
SELECT
    b.number AS block_number, b.gender,
    COUNT(a.id) AS allotted_students,
    ROUND(AVG(s.cgpa)::numeric, 2) AS avg_cgpa
FROM blocks b
JOIN rooms r     ON r."blockId" = b.id
JOIN allotments a ON a."roomId" = r.id
JOIN students s  ON a."studentId" = s.id
WHERE a.status = 'ALLOTTED'
GROUP BY b.number, b.gender
ORDER BY b.number;


-- =====================================================================
-- PART 3: ADMIN MUTATIONS (BEGIN/ROLLBACK — executes but reverts)
-- =====================================================================

-- ---- 3A. Create a new allotment session ----
BEGIN;
    INSERT INTO allotment_sessions (name, status, "createdAt")
    VALUES ('Demo Session - Prof Eval', 'DRAFT', CURRENT_TIMESTAMP)
    RETURNING id, name, status;
ROLLBACK;   -- <-- Reverts the insert; database unchanged after this block


-- ---- 3B. Batch CSV Upload simulation (with duplicate protection) ----
BEGIN;
    INSERT INTO students ("regNo", name, gender, year, department, cgpa, source, "sessionId")
    VALUES
        ('DEMO001', 'Alice Sharma',   'FEMALE', 3, 'CSE',  9.2, 'CSV', (SELECT MAX(id) FROM allotment_sessions)),
        ('DEMO002', 'Bob Patel',      'MALE',   2, 'ECE',  8.7, 'CSV', (SELECT MAX(id) FROM allotment_sessions)),
        ('DEMO003', 'Carol Reddy',    'FEMALE', 4, 'MECH', 7.8, 'CSV', (SELECT MAX(id) FROM allotment_sessions))
    ON CONFLICT ("regNo", "sessionId") DO NOTHING
    RETURNING "regNo", name, cgpa;
ROLLBACK;


-- ---- 3C. Open Portal & Erase Old Groups (Atomic Transaction) ----
BEGIN;
    UPDATE allotment_sessions
    SET "portalStatus" = 'OPEN'
    WHERE id = (SELECT MAX(id) FROM allotment_sessions);
    
    -- When opening the portal, erase existing portal submissions for a clean slate
    DELETE FROM portal_groups 
    WHERE "sessionId" = (SELECT MAX(id) FROM allotment_sessions);
ROLLBACK;


-- ---- 3D. Set Algorithm Rules (Block Cutoffs) ----
BEGIN;
    -- Enable cutoffs and max CGPA difference on the session
    UPDATE allotment_sessions
    SET "blockCutoffsEnabled" = true,
        "maxCgpaDiffEnabled" = true,
        "maxCgpaDiff" = 1.5
    WHERE id = (SELECT MAX(id) FROM allotment_sessions);

    -- Insert/Update a cutoff value for a specific Block
    INSERT INTO block_cutoffs ("sessionId", "blockId", "minCgpa")
    VALUES (
        (SELECT MAX(id) FROM allotment_sessions),
        (SELECT id FROM blocks LIMIT 1),
        8.0
    )
    ON CONFLICT ("sessionId", "blockId") 
    DO UPDATE SET "minCgpa" = EXCLUDED."minCgpa"
    RETURNING "sessionId", "blockId", "minCgpa";
ROLLBACK;


-- =====================================================================
-- PART 4: STUDENT PORTAL MUTATIONS (BEGIN/ROLLBACK — executes but reverts)
-- =====================================================================

-- ---- 4A. Student Portal Registration ----
BEGIN;
    INSERT INTO students ("regNo", name, gender, year, department, cgpa, password, source, "sessionId")
    VALUES (
        'PORTALDEMO01', 'Demo Student', 'MALE', 2, 'CSE', 8.5,
        '$2b$10$demohashedpw.....', 'PORTAL',
        (SELECT MAX(id) FROM allotment_sessions)
    )
    ON CONFLICT ("regNo", "sessionId") DO NOTHING
    RETURNING id, "regNo", name, source;
ROLLBACK;


-- ---- 4B. Student Login Lookup (Read-only; returns portal students) ----
SELECT id, "regNo", name, gender, source
FROM students
WHERE source = 'PORTAL'
ORDER BY id DESC
LIMIT 5;


-- ---- 4C. Student "My Dashboard" data (multi-table LEFT JOIN) ----
SELECT
    s."regNo", s.name, s.gender, s.year, s.department, s.cgpa,
    a.status  AS allotment_status,
    r."roomNumber",
    b.number  AS block_number
FROM students s
LEFT JOIN allotments a ON s.id = a."studentId"
LEFT JOIN rooms r      ON a."roomId" = r.id
LEFT JOIN blocks b     ON r."blockId" = b.id
WHERE s."sessionId" = (SELECT MAX(id) FROM allotment_sessions)
ORDER BY s.cgpa DESC
LIMIT 5;


-- ---- 4D. Create Portal Group + Member (full flow, then rollback) ----
BEGIN;
    -- Step 1: Create the group (using first student as leader)
    INSERT INTO portal_groups ("inviteCode", "leaderId", "sessionId", "isSubmitted")
    VALUES (
        'DEMO-INV-99',
        (SELECT id FROM students WHERE "sessionId" = (SELECT MAX(id) FROM allotment_sessions) LIMIT 1),
        (SELECT MAX(id) FROM allotment_sessions),
        false
    )
    RETURNING id, "inviteCode", "leaderId";

    -- Step 2: Add a second student to the group
    INSERT INTO portal_group_members ("portalGroupId", "studentId")
    SELECT
        (SELECT id FROM portal_groups WHERE "inviteCode" = 'DEMO-INV-99'),
        (SELECT id FROM students WHERE "sessionId" = (SELECT MAX(id) FROM allotment_sessions) LIMIT 1 OFFSET 1);

    -- Step 3: View the new group
    SELECT pg.id, pg."inviteCode", COUNT(pgm.id) AS member_count
    FROM portal_groups pg
    LEFT JOIN portal_group_members pgm ON pg.id = pgm."portalGroupId"
    WHERE pg."inviteCode" = 'DEMO-INV-99'
    GROUP BY pg.id;
ROLLBACK;


-- ---- 4E. Lock Group Preferences (update, then rollback) ----
BEGIN;
    UPDATE portal_groups
    SET
        "pref1BlockId"    = (SELECT id FROM blocks ORDER BY id ASC LIMIT 1),
        "pref1RoomTypeId" = (SELECT id FROM room_types ORDER BY id ASC LIMIT 1),
        "pref2BlockId"    = (SELECT id FROM blocks ORDER BY id ASC LIMIT 1 OFFSET 1),
        "pref2RoomTypeId" = (SELECT id FROM room_types ORDER BY id ASC LIMIT 1 OFFSET 1),
        "isSubmitted"     = true
    WHERE id = (SELECT MAX(id) FROM portal_groups)
    RETURNING id, "isSubmitted", "pref1BlockId", "pref2BlockId";
ROLLBACK;


-- ---- 4F. Leave Group (DELETE member, then rollback) ----
BEGIN;
    DELETE FROM portal_group_members
    WHERE "studentId" = (SELECT id FROM students LIMIT 1)
      AND "portalGroupId" = (SELECT MAX(id) FROM portal_groups)
    RETURNING *;
ROLLBACK;


-- =====================================================================
-- PART 5: ALLOTMENT ENGINE SQL EQUIVALENTS
-- =====================================================================

-- ---- 5A. Load and sort groups by CGPA for the algorithm ----
-- (Returns 0 rows if no StudentGroups exist; runs without error)
SELECT sg.id, sg."avgCgpa", sg.size, MIN(s.year) AS min_year
FROM student_groups sg
JOIN group_members gm ON sg.id = gm."groupId"
JOIN students s       ON gm."studentId" = s.id
WHERE sg."sessionId" = (SELECT MAX(id) FROM allotment_sessions)
GROUP BY sg.id
ORDER BY sg."avgCgpa" DESC, min_year ASC;


-- ---- 5B. Sync Portal Groups → Student Groups (engine pre-step) ----
-- (Returns 0 rows to insert if no submitted portal groups exist)
SELECT
    COUNT(pgm."studentId")                     AS size,
    ROUND(AVG(s.cgpa)::numeric, 2)             AS "avgCgpa",
    pg."pref1BlockId", pg."pref1RoomTypeId",
    pg."pref2BlockId", pg."pref2RoomTypeId",
    pg."sessionId"
FROM portal_groups pg
JOIN portal_group_members pgm ON pg.id = pgm."portalGroupId"
JOIN students s               ON pgm."studentId" = s.id
WHERE pg."sessionId" = (SELECT MAX(id) FROM allotment_sessions)
  AND pg."isSubmitted" = true
GROUP BY pg.id;


-- ---- 5C. Batch Allotment Transaction Demo ----
BEGIN;
    INSERT INTO allotments ("studentId", "roomId", "groupId", "round", status, "sessionId")
    SELECT
        s.id,
        r.id,
        1,                      -- placeholder groupId; engine computes this
        1,
        'ALLOTTED',
        s."sessionId"
    FROM students s
    CROSS JOIN rooms r
    WHERE s."sessionId" = (SELECT MAX(id) FROM allotment_sessions)
    LIMIT 1                     -- Only 1 row for demo
    RETURNING "studentId", "roomId", status;
ROLLBACK;
