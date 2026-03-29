import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-student-jwt-secret-2025';

function verifyToken(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    try { return jwt.verify(authHeader.slice(7), JWT_SECRET); } catch { return null; }
}

// PATCH /api/student/groups/preferences
export async function PATCH(request) {
    const payload = verifyToken(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.allotmentSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.portalStatus !== 'OPEN') {
        return NextResponse.json({ error: 'Portal is not open.' }, { status: 400 });
    }

    const { pref1BlockId, pref1RoomTypeId, pref2BlockId, pref2RoomTypeId, submit } = await request.json();
    if (!pref1BlockId || !pref1RoomTypeId || !pref2BlockId || !pref2RoomTypeId) {
        return NextResponse.json({ error: 'All four preference fields are required.' }, { status: 400 });
    }

    const membership = await prisma.portalGroupMember.findFirst({
        where: { portalStudentId: payload.portalStudentId },
        include: {
            portalGroup: {
                include: { members: { include: { portalStudent: true } } }
            }
        }
    });

    if (!membership) return NextResponse.json({ error: 'You are not in any group.' }, { status: 404 });
    if (membership.portalGroup.leaderId !== payload.portalStudentId) {
        return NextResponse.json({ error: 'Only the group leader can set preferences.' }, { status: 403 });
    }
    if (membership.portalGroup.isSubmitted) {
        return NextResponse.json({ error: 'Preferences already submitted and locked.' }, { status: 400 });
    }

    const groupSize = membership.portalGroup.members.length;
    const gender = membership.portalGroup.members[0].portalStudent.gender;

    const block1 = await prisma.block.findUnique({ where: { id: parseInt(pref1BlockId) } });
    const rt1 = await prisma.roomType.findUnique({ where: { id: parseInt(pref1RoomTypeId) } });
    if (!block1 || !rt1) return NextResponse.json({ error: 'Invalid Pref 1 block or room type.' }, { status: 400 });
    if (block1.gender !== gender) return NextResponse.json({ error: `Pref 1 — Block ${block1.number} is for ${block1.gender === 'MALE' ? 'boys' : 'girls'} only.` }, { status: 400 });
    if (rt1.capacity < groupSize) return NextResponse.json({ error: `Pref 1 — "${rt1.name}" (cap ${rt1.capacity}) is too small for your group of ${groupSize}.` }, { status: 400 });

    const block2 = await prisma.block.findUnique({ where: { id: parseInt(pref2BlockId) } });
    const rt2 = await prisma.roomType.findUnique({ where: { id: parseInt(pref2RoomTypeId) } });
    if (!block2 || !rt2) return NextResponse.json({ error: 'Invalid Pref 2 block or room type.' }, { status: 400 });
    if (block2.gender !== gender) return NextResponse.json({ error: `Pref 2 — Block ${block2.number} is for ${block2.gender === 'MALE' ? 'boys' : 'girls'} only.` }, { status: 400 });
    if (rt2.capacity < groupSize) return NextResponse.json({ error: `Pref 2 — "${rt2.name}" (cap ${rt2.capacity}) is too small for your group of ${groupSize}.` }, { status: 400 });

    if (parseInt(pref1BlockId) === parseInt(pref2BlockId) && parseInt(pref1RoomTypeId) === parseInt(pref2RoomTypeId)) {
        return NextResponse.json({ error: 'Pref 1 and Pref 2 must be different.' }, { status: 400 });
    }

    await prisma.portalGroup.update({
        where: { id: membership.portalGroupId },
        data: {
            pref1BlockId: parseInt(pref1BlockId), pref1RoomTypeId: parseInt(pref1RoomTypeId),
            pref2BlockId: parseInt(pref2BlockId), pref2RoomTypeId: parseInt(pref2RoomTypeId),
            isSubmitted: submit === true,
        }
    });

    return NextResponse.json({
        message: submit ? 'Preferences submitted and locked! ✅' : 'Preferences saved as draft.',
        isSubmitted: submit === true,
    });
}
