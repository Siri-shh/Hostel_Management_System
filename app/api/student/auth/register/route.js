import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

/**
 * POST /api/student/auth/register
 *
 * Creates a new PORTAL student account for the currently OPEN allotment session.
 *
 * ─── SQL Injection Protection ─────────────────────────────────────────────────
 * This route is protected against SQL injection by design:
 *
 * 1. ALL database interactions go through Prisma ORM's model methods
 *    (findFirst, create, findUnique). Prisma uses driver-level parameterised
 *    queries — user-supplied values are NEVER interpolated into SQL strings.
 *
 * 2. Every field is strictly validated and typed before being passed to Prisma:
 *    - regNo  → must match /^\d{9}$/ (purely numeric, no special chars)
 *    - name   → must match /^[a-zA-Z][a-zA-Z\s]{1,49}$/ (no SQL keywords / chars)
 *    - gender → strict enum check ('MALE' | 'FEMALE')
 *    - year   → integer coerced and range-checked
 *    - dept   → whitelist of known department codes
 *    - cgpa   → float coerced and range-checked (0–10)
 *    - password → minimum complexity enforced; stored as bcrypt hash
 *
 * 3. The $executeRawUnsafe used in setup-db-extensions.js contains only
 *    HARDCODED SQL strings — no user input is ever passed into raw queries.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_DEPARTMENTS = new Set([
    'AE', 'AT', 'BT', 'CE', 'CH', 'CHE', 'CS', 'CSE', 'CSBS', 'CV', 'DS',
    'EC', 'ECE', 'EE', 'EEE', 'EI', 'ENI', 'ICE', 'IE', 'IS', 'IT',
    'IM', 'MA', 'ME', 'MT', 'PE', 'PH', 'PI', 'TT',
]);

export async function POST(request) {
    try {
        const body = await request.json();
        const { regNo, name, gender, year, department, cgpa, password } = body;

        // ── 1. Presence check ─────────────────────────────────────────────────
        if (!regNo || !name || !gender || !year || !department || cgpa === undefined || cgpa === '' || !password) {
            return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
        }

        // ── 2. Registration Number: exactly 9 numeric digits ──────────────────
        const cleanRegNo = String(regNo).trim().toUpperCase();
        if (!/^\d{9}$/.test(cleanRegNo)) {
            return NextResponse.json({
                error: 'Registration number must be exactly 9 digits (numbers only). e.g. 210905001',
            }, { status: 400 });
        }

        // ── 3. Name: letters and spaces only, 2+ words ────────────────────────
        const cleanName = String(name).trim();
        if (!/^[a-zA-Z][a-zA-Z\s]{1,49}$/.test(cleanName)) {
            return NextResponse.json({
                error: 'Name must contain letters only (no numbers or special characters).',
            }, { status: 400 });
        }
        if (cleanName.split(/\s+/).filter(Boolean).length < 2) {
            return NextResponse.json({
                error: 'Please enter your full name (at least first and last name).',
            }, { status: 400 });
        }

        // ── 4. Gender: strict enum ────────────────────────────────────────────
        if (!['MALE', 'FEMALE'].includes(gender)) {
            return NextResponse.json({ error: 'Gender must be MALE or FEMALE.' }, { status: 400 });
        }

        // ── 5. Year: integer, 2–4 only ────────────────────────────────────────
        const yearInt = parseInt(year, 10);
        if (isNaN(yearInt) || ![2, 3, 4].includes(yearInt)) {
            return NextResponse.json({ error: 'Year must be 2, 3, or 4.' }, { status: 400 });
        }

        // ── 6. Department: whitelist check ────────────────────────────────────
        const cleanDept = String(department).trim().toUpperCase();
        if (!VALID_DEPARTMENTS.has(cleanDept)) {
            return NextResponse.json({ error: `"${cleanDept}" is not a recognised department code.` }, { status: 400 });
        }

        // ── 7. CGPA: 0.00–10.00, up to 2 decimal places ──────────────────────
        const cgpaNum = parseFloat(cgpa);
        if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
            return NextResponse.json({ error: 'CGPA must be between 0.00 and 10.00.' }, { status: 400 });
        }
        // Allow max 2 decimal places
        if (!/^\d+(\.\d{1,2})?$/.test(String(cgpa))) {
            return NextResponse.json({ error: 'CGPA can have at most 2 decimal places (e.g. 8.75).' }, { status: 400 });
        }

        // ── 8. Password: min 8 chars, at least 1 letter + 1 number ───────────
        const pw = String(password);
        if (pw.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
        }
        if (!/[a-zA-Z]/.test(pw)) {
            return NextResponse.json({ error: 'Password must contain at least one letter.' }, { status: 400 });
        }
        if (!/\d/.test(pw)) {
            return NextResponse.json({ error: 'Password must contain at least one number.' }, { status: 400 });
        }

        // ── 9. Find the active OPEN portal session ────────────────────────────
        // Prisma uses a parameterised WHERE clause — this is not vulnerable to injection.
        const activeSession = await prisma.allotmentSession.findFirst({
            where: { portalStatus: 'OPEN' },
            orderBy: { createdAt: 'desc' },
        });
        if (!activeSession) {
            return NextResponse.json({
                error: 'No portal session is currently open. Registration is closed.',
            }, { status: 404 });
        }

        // ── 10. Duplicate registration number check ───────────────────────────
        const existing = await prisma.student.findUnique({
            where: { regNo_sessionId: { regNo: cleanRegNo, sessionId: activeSession.id } },
        });
        if (existing) {
            if (existing.source === 'CSV') {
                return NextResponse.json({
                    error: `Reg No ${cleanRegNo} is already registered via admin data. Contact the hostel office if you need portal access.`,
                }, { status: 409 });
            }
            return NextResponse.json({ error: 'You are already registered. Please login instead.' }, { status: 409 });
        }

        // ── 11. Hash password and create student ──────────────────────────────
        // bcrypt with 12 rounds — computationally expensive, prevents brute-force.
        const hashedPassword = await bcrypt.hash(pw, 12);

        const student = await prisma.student.create({
            data: {
                regNo: cleanRegNo,
                name: cleanName,
                gender,
                year: yearInt,
                department: cleanDept,
                cgpa: Math.round(cgpaNum * 100) / 100, // normalise to 2dp
                sessionId: activeSession.id,
                source: 'PORTAL',
                password: hashedPassword,
            },
        });

        // ── 12. Issue JWT ─────────────────────────────────────────────────────
        const token = jwt.sign(
            { studentId: student.id, regNo: student.regNo, sessionId: activeSession.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            token,
            student: {
                id: student.id, regNo: student.regNo, name: student.name,
                gender: student.gender, year: student.year,
                department: student.department, cgpa: student.cgpa,
                source: student.source,
            },
        });

    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}