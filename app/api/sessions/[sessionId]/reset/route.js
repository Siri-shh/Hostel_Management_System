import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/sessions/[sessionId]/reset
 * Clears all allotment data for a session, resetting it back to DRAFT status.
 * Students and groups are preserved — only allotment results are cleared.
 */
export async function DELETE(request, { params }) {
    try {
        const { sessionId: sessionIdStr } = await params;
        const sessionId = parseInt(sessionIdStr);
        if (isNaN(sessionId)) {
            return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
        }

        const session = await prisma.allotmentSession.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Delete all allotments for this session
        const deleted = await prisma.allotment.deleteMany({
            where: { sessionId },
        });

        // Reset session status to DRAFT
        await prisma.allotmentSession.update({
            where: { id: sessionId },
            data: { status: 'DRAFT' },
        });

        return NextResponse.json({
            message: `Reset complete. Deleted ${deleted.count} allotment records.`,
            deletedCount: deleted.count,
        });
    } catch (error) {
        console.error('Reset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
