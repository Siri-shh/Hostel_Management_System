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

        await prisma.allotmentSession.update({
            where: { id: sessionId },
            data: { portalStatus },
        });

        return NextResponse.json({ message: `Portal status updated to ${portalStatus}`, portalStatus });
    } catch (error) {
        console.error('Portal status update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
