import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/sessions/[sessionId]/lock-round1
// Transitions a session from ROUND1_DONE → ROUND1_LOCKED.
// Once locked, Round 2 becomes available and no more disallowals are permitted.
export async function PATCH(request, { params }) {
    try {
        const sessionId = parseInt(params.sessionId);
        if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });

        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        if (session.status !== 'ROUND1_DONE') {
            return NextResponse.json({
                error: `Cannot lock — session status is "${session.status}". Must be ROUND1_DONE.`
            }, { status: 400 });
        }

        await prisma.allotmentSession.update({
            where: { id: sessionId },
            data: { status: 'ROUND1_LOCKED' },
        });

        // Count remaining allotted and disallowed for reporting
        const allotted = await prisma.allotment.count({ where: { sessionId, status: 'ALLOTTED' } });
        const disallowed = await prisma.allotment.count({ where: { sessionId, status: 'DISALLOWED' } });

        return NextResponse.json({
            message: 'Round 1 locked. Round 2 is now available.',
            allottedCount: allotted,
            disallowedCount: disallowed,
        });
    } catch (error) {
        console.error('Lock round 1 error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
