import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

// GET /api/student/me — returns full profile, portal group, and allotment result.
// All data now lives in the Student table; no cross-table lookup required.
export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let payload;
        try {
            payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        } catch {
            return NextResponse.json({ error: 'Invalid or expired token. Please log in again.' }, { status: 401 });
        }

        const student = await prisma.student.findUnique({
            where: { id: payload.studentId },
            include: {
                session: true,
                portalMemberships: {
                    include: {
                        portalGroup: {
                            include: {
                                members: { include: { student: true } },
                                pref1Block: true,
                                pref1RoomType: true,
                                pref2Block: true,
                                pref2RoomType: true,
                            },
                        },
                    },
                },
                allotments: {
                    where: { status: 'ALLOTTED' },
                    include: {
                        room: { include: { block: true, roomType: true } },
                    },
                    orderBy: { round: 'desc' },
                    take: 1,
                },
            },
        });

        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        const session = student.session;
        const portalGroup = student.portalMemberships[0]?.portalGroup || null;

        // Build allotment result if present
        let allotment = null;
        if (student.allotments.length > 0) {
            const a = student.allotments[0];
            // Fetch roommates (same room, same session, different student, ALLOTTED)
            const roommateAllotments = await prisma.allotment.findMany({
                where: {
                    roomId: a.roomId,
                    sessionId: student.sessionId,
                    status: 'ALLOTTED',
                    NOT: { studentId: student.id },
                },
                include: { student: true },
            });
            allotment = {
                status: 'ALLOTTED',
                round: a.round,
                block: a.room?.block?.number,
                roomNumber: a.room?.roomNumber,
                floor: a.room?.floor,
                roomType: a.room?.roomType?.name,
                roomTypeCode: a.room?.roomType?.code,
                roommates: roommateAllotments.map(r => ({
                    name: r.student.name,
                    regNo: r.student.regNo,
                    department: r.student.department,
                    year: r.student.year,
                })),
            };
        }

        return NextResponse.json({
            student: {
                id: student.id, regNo: student.regNo, name: student.name,
                gender: student.gender, year: student.year,
                department: student.department, cgpa: student.cgpa,
                source: student.source, sessionId: student.sessionId,
            },
            session: {
                id: session.id,
                name: session.name,
                portalStatus: session.portalStatus,
                allotmentStatus: session.status,
            },
            portalGroup: portalGroup ? {
                id: portalGroup.id,
                inviteCode: portalGroup.inviteCode,
                isLeader: portalGroup.leaderId === student.id,
                isSubmitted: portalGroup.isSubmitted,
                members: portalGroup.members.map(m => ({
                    id: m.student.id,
                    name: m.student.name,
                    regNo: m.student.regNo,
                    year: m.student.year,
                    department: m.student.department,
                    cgpa: m.student.cgpa,
                    source: m.student.source,
                })),
                avgCgpa: portalGroup.members.length > 0
                    ? Math.round(
                        (portalGroup.members.reduce((s, m) => s + m.student.cgpa, 0) / portalGroup.members.length) * 100
                    ) / 100
                    : null,
                priorityYear: portalGroup.members.length > 0
                    ? Math.min(...portalGroup.members.map(m => m.student.year))
                    : null,
                pref1: portalGroup.pref1Block
                    ? { block: portalGroup.pref1Block, roomType: portalGroup.pref1RoomType }
                    : null,
                pref2: portalGroup.pref2Block
                    ? { block: portalGroup.pref2Block, roomType: portalGroup.pref2RoomType }
                    : null,
            } : null,
            allotment,
        });
    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
