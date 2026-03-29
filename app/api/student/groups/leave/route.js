import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    try { return jwt.verify(authHeader.slice(7), JWT_SECRET); } catch { return null; }
}

// DELETE /api/student/groups/leave
export async function DELETE(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open.' }, { status: 400 });
    }

    const membership = await prisma.portalGroupMember.findFirst({
        where: { portalStudentId: payload.portalStudentId },
        include: { portalGroup: true }
    });

    if (!membership) return NextResponse.json({ error: 'You are not in any group.' }, { status: 404 });
    if (membership.portalGroup.isSubmitted) return NextResponse.json({ error: 'Preferences already submitted. Cannot leave.' }, { status: 400 });

    const isLeader = membership.portalGroup.leaderId === payload.portalStudentId;

    if (isLeader) {
        await prisma.portalGroup.delete({ where: { id: membership.portalGroupId } });
        return NextResponse.json({ message: 'Group dissolved. As the leader, your group has been deleted.' });
    } else {
        await prisma.portalGroupMember.delete({ where: { id: membership.id } });
        return NextResponse.json({ message: 'Left the group successfully.' });
    }
}
