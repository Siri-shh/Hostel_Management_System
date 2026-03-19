import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/allotments/[allotmentId]/disallow
// Disallows an allotment and all other allotments in the same group.
// The room is freed implicitly — occupancy is computed from ALLOTTED records only.
// Other individuals sharing the same physical room (from different groups) are unaffected.
export async function PATCH(request, { params }) {
    try {
        const allotmentId = parseInt(params.allotmentId);
        if (isNaN(allotmentId)) {
            return NextResponse.json({ error: 'Invalid allotment ID' }, { status: 400 });
        }

        // Find the target allotment to get its groupId
        const allotment = await prisma.allotment.findUnique({
            where: { id: allotmentId },
            include: {
                group: { include: { members: { include: { student: true } } } },
                student: true,
            },
        });

        if (!allotment) return NextResponse.json({ error: 'Allotment not found' }, { status: 404 });
        if (allotment.status !== 'ALLOTTED') {
            return NextResponse.json({ error: `Cannot disallow — current status is ${allotment.status}` }, { status: 400 });
        }

        const sessionId = allotment.sessionId;

        // Check session is in ROUND1_DONE state (not yet locked)
        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (session.status !== 'ROUND1_DONE') {
            return NextResponse.json({ error: 'Can only disallow during the Round 1 verification phase.' }, { status: 400 });
        }

        // Mark ALL allotments in this group as DISALLOWED (they applied together, so they go together)
        const result = await prisma.allotment.updateMany({
            where: {
                groupId: allotment.groupId,
                sessionId,
                status: 'ALLOTTED',
            },
            data: { status: 'DISALLOWED', roomId: null },
        });

        const disallowedNames = allotment.group.members.map(m => m.student.name).join(', ');

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
