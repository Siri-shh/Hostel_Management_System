import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    try { return jwt.verify(authHeader.slice(7), JWT_SECRET); } catch { return null; }
}

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// GET /api/student/groups
export async function GET(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await prisma.portalGroupMember.findFirst({
        where: { studentId: payload.studentId },
        include: {
            portalGroup: {
                include: {
                    members: { include: { student: true } },
                    pref1Block: true, pref1RoomType: true,
                    pref2Block: true, pref2RoomType: true,
                },
            },
        },
    });

    if (!membership) return NextResponse.json({ group: null });

    const g = membership.portalGroup;
    return NextResponse.json({
        group: {
            id: g.id,
            inviteCode: g.inviteCode,
            isLeader: g.leaderId === payload.studentId,
            isSubmitted: g.isSubmitted,
            members: g.members.map(m => ({
                id: m.student.id, name: m.student.name, regNo: m.student.regNo,
                year: m.student.year, department: m.student.department,
                cgpa: m.student.cgpa, gender: m.student.gender, source: m.student.source,
            })),
            avgCgpa: g.members.length > 0
                ? Math.round((g.members.reduce((s, m) => s + m.student.cgpa, 0) / g.members.length) * 100) / 100
                : null,
            priorityYear: g.members.length > 0
                ? Math.min(...g.members.map(m => m.student.year))
                : null,
            pref1: g.pref1Block ? { block: g.pref1Block, roomType: g.pref1RoomType } : null,
            pref2: g.pref2Block ? { block: g.pref2Block, roomType: g.pref2RoomType } : null,
        },
    });
}

// POST /api/student/groups — create a new group
export async function POST(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open for group formation.' }, { status: 400 });
    }

    const already = await prisma.portalGroupMember.findFirst({ where: { studentId: payload.studentId } });
    if (already) return NextResponse.json({ error: 'You are already in a group. Leave it first.' }, { status: 409 });

    // Generate a unique invite code
    let inviteCode;
    for (let attempts = 0; attempts < 10; attempts++) {
        inviteCode = generateInviteCode();
        const taken = await prisma.portalGroup.findUnique({ where: { inviteCode } });
        if (!taken) break;
    }

    const group = await prisma.portalGroup.create({
        data: {
            sessionId: payload.sessionId,
            inviteCode,
            leaderId: payload.studentId,
            members: { create: { studentId: payload.studentId } },
        },
    });

    return NextResponse.json({
        message: 'Group created!',
        inviteCode: group.inviteCode,
        groupId: group.id,
    });
}
