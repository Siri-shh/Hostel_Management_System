import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    try { return jwt.verify(auth.slice(7), JWT_SECRET); } catch { return null; }
}

// POST /api/student/groups/join
export async function POST(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { inviteCode } = await request.json();
    if (!inviteCode) return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open.' }, { status: 400 });
    }

    // Check not already in a group
    const alreadyIn = await prisma.portalGroupMember.findFirst({ where: { studentId: payload.studentId } });
    if (alreadyIn) return NextResponse.json({ error: 'You are already in a group. Leave it first.' }, { status: 409 });

    // Find the target group
    const group = await prisma.portalGroup.findUnique({
        where: { inviteCode: inviteCode.trim().toUpperCase() },
        include: { members: { include: { student: true } } },
    });

    if (!group) return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 });
    if (group.sessionId !== payload.sessionId) {
        return NextResponse.json({ error: 'This invite code belongs to a different session.' }, { status: 400 });
    }
    if (group.isSubmitted) {
        return NextResponse.json({ error: 'This group has already submitted preferences and is locked.' }, { status: 400 });
    }
    if (group.members.length >= 3) {
        return NextResponse.json({ error: 'Group is full (max 3 members).' }, { status: 400 });
    }

    // Gender validation
    const me = await prisma.student.findUnique({ where: { id: payload.studentId } });
    const existingGender = group.members[0]?.student?.gender;
    if (existingGender && me.gender !== existingGender) {
        return NextResponse.json({ error: 'Cannot join a group with students of a different gender.' }, { status: 400 });
    }

    await prisma.portalGroupMember.create({
        data: { portalGroupId: group.id, studentId: payload.studentId },
    });

    return NextResponse.json({ message: `Joined! Group now has ${group.members.length + 1} member(s).` });
}
