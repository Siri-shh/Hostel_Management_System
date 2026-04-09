import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/allotments/[allotmentId]/disallow
// Disallows an allotment and all other allotments in the same group.
// The room is freed implicitly — occupancy is computed from ALLOTTED records only.
// Other individuals sharing the same physical room (from different groups) are unaffected.
export async function PATCH(request, { params }) {
    try {
        const { allotmentId: allotmentIdStr } = await params;
        const allotmentId = parseInt(allotmentIdStr);
        if (isNaN(allotmentId)) {
            return NextResponse.json({ error: 'Invalid allotment ID' }, { status: 400 });
        }

        // Lean fetch — only grab what we actually need for validation + update
        const allotment = await prisma.allotment.findUnique({
            where: { id: allotmentId },
            select: { id: true, groupId: true, sessionId: true, status: true },
        });

        if (!allotment) return NextResponse.json({ error: 'Allotment not found' }, { status: 404 });
        if (allotment.status !== 'ALLOTTED') {
            return NextResponse.json({ error: `Cannot disallow — current status is ${allotment.status}` }, { status: 400 });
        }

        // Check session is in ROUND1_DONE state
        const session = await prisma.allotmentSession.findUnique({
            where: { id: allotment.sessionId },
            select: { status: true },
        });
        if (session?.status !== 'ROUND1_DONE') {
            return NextResponse.json({ error: 'Can only disallow during the Round 1 verification phase.' }, { status: 400 });
        }

        // Disallow all allotments in this group in a single updateMany
        const result = await prisma.allotment.updateMany({
            where: {
                groupId: allotment.groupId,
                sessionId: allotment.sessionId,
                status: 'ALLOTTED',
            },
            data: { status: 'DISALLOWED', roomId: null },
        });

        // Fetch student names separately for the response message (lean select)
        const members = await prisma.groupMember.findMany({
            where: { groupId: allotment.groupId },
            select: { student: { select: { name: true } } },
        });
        const disallowedNames = members.map(m => m.student.name).join(', ');

        return NextResponse.json({
            message: `Disallowed ${result.count} allotment(s) for group: ${disallowedNames}`,
            disallowedCount: result.count,
            groupId: allotment.groupId,
        });
    } catch (error) {
        console.error('Disallow error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
