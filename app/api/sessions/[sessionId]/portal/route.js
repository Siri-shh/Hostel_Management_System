import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/sessions/[sessionId]/portal
// Admin toggles portal status: CLOSED → OPEN → LOCKED
export async function PATCH(request, { params }) {
    try {
        const sessionId = parseInt(params.sessionId);
        const { portalStatus } = await request.json();

        if (!['CLOSED', 'OPEN', 'LOCKED'].includes(portalStatus)) {
            return NextResponse.json({ error: 'Invalid portalStatus. Must be CLOSED, OPEN, or LOCKED.' }, { status: 400 });
        }

        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        await prisma.$transaction(async (tx) => {
            await tx.allotmentSession.update({
                where: { id: sessionId },
                data: { portalStatus },
            });

            // If the portal is being opened from a CLOSED state, wipe existing portal submissions.
            // This ensures students form fresh groups under the locked algorithm rules.
            if (portalStatus === 'OPEN' && session.portalStatus === 'CLOSED') {
                await tx.portalGroup.deleteMany({
                    where: { sessionId },
                });
                console.log(`[Portal] Session ${sessionId} portal opened. All previous portal groups wiped.`);
            }
        });

        return NextResponse.json({ message: `Portal status updated to ${portalStatus}`, portalStatus });
    } catch (error) {
        console.error('Portal status update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
