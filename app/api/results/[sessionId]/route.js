import { NextResponse } from 'next/server';
import { getSessionStats } from '@/lib/allotment-engine';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
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

        const stats = await getSessionStats(sessionId);
        return NextResponse.json({ ...stats, session });
    } catch (error) {
        console.error('Results error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
