import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

// POST /api/student/auth/register
// Real student self-registers with their details. No CSV upload required.
// They are completely separate from the synthetic CSV-imported Student records.
export async function POST(request) {
    try {
        const { regNo, name, gender, year, department, cgpa, password } = await request.json();

        // Validate required fields
        if (!regNo || !name || !gender || !year || !department || !cgpa || !password) {
            return NextResponse.json({ error: 'All fields are required: regNo, name, gender, year, department, cgpa, password.' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
        }
        if (!['MALE', 'FEMALE'].includes(gender)) {
            return NextResponse.json({ error: 'Gender must be MALE or FEMALE.' }, { status: 400 });
        }
        if (![2, 3, 4].includes(parseInt(year))) {
            return NextResponse.json({ error: 'Year must be 2, 3, or 4.' }, { status: 400 });
        }
        const cgpaNum = parseFloat(cgpa);
        if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
            return NextResponse.json({ error: 'CGPA must be between 0 and 10.' }, { status: 400 });
        }

        // Find the active open portal session
        const activeSession = await prisma.allotmentSession.findFirst({
            where: { portalStatus: 'OPEN' },
            orderBy: { createdAt: 'desc' },
        });
        if (!activeSession) {
            return NextResponse.json({ error: 'No portal session is currently open. Check back when registration opens.' }, { status: 404 });
        }

        // Check if this regNo is already registered for this session
        const existing = await prisma.portalStudent.findUnique({
            where: { regNo_sessionId: { regNo: regNo.trim().toUpperCase(), sessionId: activeSession.id } },
        });
        if (existing) {
            return NextResponse.json({ error: 'You have already registered. Please login instead.' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const student = await prisma.portalStudent.create({
            data: {
                regNo: regNo.trim().toUpperCase(),
                name: name.trim(),
                gender,
                year: parseInt(year),
                department: department.trim().toUpperCase(),
                cgpa: cgpaNum,
                password: hashedPassword,
                sessionId: activeSession.id,
            },
        });

        const token = jwt.sign(
            { portalStudentId: student.id, regNo: student.regNo, sessionId: activeSession.id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            token,
            student: { id: student.id, regNo: student.regNo, name: student.name, gender: student.gender, year: student.year, department: student.department, cgpa: student.cgpa },
        });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
