import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

// GET /api/student/me
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

        const student = await prisma.portalStudent.findUnique({
            where: { id: payload.portalStudentId },
            include: {
                session: true,
                groupMemberships: {
                    include: {
                        portalGroup: {
                            include: {
                                members: { include: { portalStudent: true } },
                                pref1Block: true,
                                pref1RoomType: true,
                                pref2Block: true,
                                pref2RoomType: true,
                            }
                        }
                    }
                },
            }
        });

        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        const portalGroup = student.groupMemberships[0]?.portalGroup || null;
        const session = student.session;

        // Check allotment result by matching regNo in the CSV-imported Student table
        // (after admin runs allotment using portal data)
        let allotment = null;
        if (session.status === 'ROUND2_DONE' || session.status === 'ROUND1_DONE' || session.status === 'ROUND1_LOCKED') {
            const csvStudent = await prisma.student.findFirst({
                where: { regNo: student.regNo, sessionId: student.sessionId },
            });
            if (csvStudent) {
                const allotmentRecord = await prisma.allotment.findFirst({
                    where: { studentId: csvStudent.id, sessionId: student.sessionId, status: 'ALLOTTED' },
                    include: {
                        room: { include: { block: true, roomType: true } },
                    },
                    orderBy: { round: 'desc' },
                });
                if (allotmentRecord) {
                    const roommateAllotments = await prisma.allotment.findMany({
                        where: {
                            roomId: allotmentRecord.roomId,
                            sessionId: student.sessionId,
                            status: 'ALLOTTED',
                            NOT: { studentId: csvStudent.id },
                        },
                        include: { student: true },
                    });
                    allotment = {
                        status: 'ALLOTTED',
                        round: allotmentRecord.round,
                        block: allotmentRecord.room?.block?.number,
                        roomNumber: allotmentRecord.room?.roomNumber,
                        floor: allotmentRecord.room?.floor,
                        roomType: allotmentRecord.room?.roomType?.name,
                        roomTypeCode: allotmentRecord.room?.roomType?.code,
                        roommates: roommateAllotments.map(a => ({
                            name: a.student.name, regNo: a.student.regNo,
                            department: a.student.department, year: a.student.year,
                        })),
                    };
                }
            }
        }

        return NextResponse.json({
            student: {
                id: student.id, regNo: student.regNo, name: student.name,
                gender: student.gender, year: student.year,
                department: student.department, cgpa: student.cgpa,
                sessionId: student.sessionId,
            },
            session: {
                id: session.id, name: session.name,
                portalStatus: session.portalStatus,
                allotmentStatus: session.status,
            },
            portalGroup: portalGroup ? {
                id: portalGroup.id,
                inviteCode: portalGroup.inviteCode,
                isLeader: portalGroup.leaderId === student.id,
                isSubmitted: portalGroup.isSubmitted,
                members: portalGroup.members.map(m => ({
                    id: m.portalStudent.id, name: m.portalStudent.name,
                    regNo: m.portalStudent.regNo, year: m.portalStudent.year,
                    department: m.portalStudent.department, cgpa: m.portalStudent.cgpa,
                })),
                avgCgpa: portalGroup.members.length > 0
                    ? Math.round((portalGroup.members.reduce((s, m) => s + m.portalStudent.cgpa, 0) / portalGroup.members.length) * 100) / 100
                    : null,
                priorityYear: portalGroup.members.length > 0
                    ? Math.min(...portalGroup.members.map(m => m.portalStudent.year))
                    : null,
                pref1: portalGroup.pref1Block ? { block: portalGroup.pref1Block, roomType: portalGroup.pref1RoomType } : null,
                pref2: portalGroup.pref2Block ? { block: portalGroup.pref2Block, roomType: portalGroup.pref2RoomType } : null,
            } : null,
            allotment,
        });
    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
