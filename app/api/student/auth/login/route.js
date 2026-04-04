import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

// POST /api/student/auth/login
// Works for PORTAL-sourced students only (they are the ones with passwords).
export async function POST(request) {
    try {
        const { regNo, password } = await request.json();
        if (!regNo || !password) {
            return NextResponse.json({ error: 'Reg No and password are required.' }, { status: 400 });
        }

        const cleanRegNo = regNo.trim().toUpperCase();

        // Find the most recent Student with this regNo that has a password set
        const student = await prisma.student.findFirst({
            where: {
                regNo: cleanRegNo,
                source: 'PORTAL',
                password: { not: null },
            },
            include: { session: true },
            orderBy: { id: 'desc' },
        });

        if (!student) {
            return NextResponse.json({
                error: 'No portal account found for this Reg No. Please register first.',
            }, { status: 404 });
        }

        const valid = await bcrypt.compare(password, student.password);
        if (!valid) {
            return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
        }

        const token = jwt.sign(
            { studentId: student.id, regNo: student.regNo, sessionId: student.sessionId },
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
                sessionId: student.sessionId,
                portalStatus: student.session.portalStatus,
                allotmentStatus: student.session.status,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
