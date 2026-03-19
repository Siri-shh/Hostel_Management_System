import { NextResponse } from 'next/server';
import { runAllotment } from '@/lib/allotment-engine';

export async function POST(request) {
    try {
        const { sessionId, round, mode } = await request.json();

        if (!sessionId || ![1, 2].includes(round)) {
            return NextResponse.json({ error: 'Need sessionId and round (1 or 2)' }, { status: 400 });
        }

        const stats = await runAllotment(sessionId, round, mode || 'preference_only');
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Allotment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
