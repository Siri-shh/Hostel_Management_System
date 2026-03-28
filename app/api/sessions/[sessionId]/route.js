import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/sessions/[sessionId]
 * Deletes an entire session and all associated data completely.
 * Prisma takes care of cascade deletion of Students, StudentGroups, and Allotments.
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

        // Deleting the session automatically deletes associated records (students, groups, allotments)
        // because of the onDelete: Cascade rule set in the Prisma schema.
        await prisma.allotmentSession.delete({
            where: { id: sessionId },
        });

        return NextResponse.json({
            message: `Deleted session "${session.name}" and all associated data.`,
            success: true
        });
    } catch (error) {
        console.error('Session deletion error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
