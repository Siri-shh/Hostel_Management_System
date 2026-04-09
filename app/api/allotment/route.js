import { NextResponse } from 'next/server';
import { runAllotment } from '@/lib/allotment-engine';
import prisma from '@/lib/prisma';

export async function POST(request) {
    try {
        const { sessionId, round, mode } = await request.json();

        if (!sessionId || ![1, 2].includes(round)) {
            return NextResponse.json({ error: 'Need sessionId and round (1 or 2)' }, { status: 400 });
        }

        // Guard: do not allow allotment while the student portal is still accepting registrations.
        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
        }
        if (session.portalStatus === 'OPEN') {
            return NextResponse.json({
                error: 'The student portal is still OPEN. Close or lock the portal from the admin panel before running allotment.',
            }, { status: 400 });
        }

        const stats = await runAllotment(sessionId, round, mode || 'preference_only');
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Allotment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
