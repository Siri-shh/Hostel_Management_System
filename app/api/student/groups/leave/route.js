import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    try { return jwt.verify(auth.slice(7), JWT_SECRET); } catch { return null; }
}

// DELETE /api/student/groups/leave
// If leader leaves → dissolve the entire group (no leaderless groups).
// If regular member → just remove them.
export async function DELETE(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open.' }, { status: 400 });
    }

    const membership = await prisma.portalGroupMember.findFirst({
        where: { studentId: payload.studentId },
        include: { portalGroup: true },
    });

    if (!membership) return NextResponse.json({ error: 'You are not in any group.' }, { status: 404 });
    if (membership.portalGroup.isSubmitted) {
        return NextResponse.json({ error: 'Preferences are locked. You cannot leave after submitting.' }, { status: 400 });
    }

    if (membership.portalGroup.leaderId === payload.studentId) {
        // Dissolve the whole group — cascade deletes all members too
        await prisma.portalGroup.delete({ where: { id: membership.portalGroupId } });
        return NextResponse.json({ message: 'Group dissolved. All members have been removed.' });
    } else {
        await prisma.portalGroupMember.delete({ where: { id: membership.id } });
        return NextResponse.json({ message: 'Left the group successfully.' });
    }
}
