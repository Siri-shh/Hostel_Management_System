import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

// POST /api/student/auth/login
export async function POST(request) {
    try {
        const { regNo, password } = await request.json();

        if (!regNo || !password) {
            return NextResponse.json({ error: 'Reg No and password required.' }, { status: 400 });
        }

        // Find the most recent PortalStudent with this regNo
        const student = await prisma.portalStudent.findFirst({
            where: { regNo: regNo.trim().toUpperCase() },
            include: { session: true },
            orderBy: { id: 'desc' },
        });

        if (!student) {
            return NextResponse.json({ error: 'Registration not found. Please complete registration first.' }, { status: 404 });
        }

        const valid = await bcrypt.compare(password, student.password);
        if (!valid) {
            return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
        }

        const token = jwt.sign(
            { portalStudentId: student.id, regNo: student.regNo, sessionId: student.sessionId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return NextResponse.json({
            token,
            student: {
                id: student.id, regNo: student.regNo, name: student.name,
                gender: student.gender, year: student.year,
                department: student.department, cgpa: student.cgpa,
                sessionId: student.sessionId,
                portalStatus: student.session.portalStatus,
                sessionStatus: student.session.status,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
