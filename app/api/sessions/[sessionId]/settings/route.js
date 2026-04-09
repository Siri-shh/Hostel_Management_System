import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/sessions/[sessionId]/settings
// Returns current algorithm rule settings + block cutoffs for the session
export async function GET(request, { params }) {
    const sessionId = parseInt(params.sessionId);
    if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });

    const session = await prisma.allotmentSession.findUnique({
        where: { id: sessionId },
        select: {
            blockCutoffsEnabled: true,
            maxCgpaDiffEnabled: true,
            maxCgpaDiff: true,
            blockCutoffs: {
                select: { blockId: true, minCgpa: true },
            },
        },
    });

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Also fetch all blocks so the UI can render a full table
    const blocks = await prisma.block.findMany({
        select: { id: true, number: true, gender: true },
        orderBy: { number: 'asc' },
    });

    // Merge block info with cutoff values
    const cutoffMap = new Map(session.blockCutoffs.map(c => [c.blockId, c.minCgpa]));
    const blocksWithCutoffs = blocks.map(b => ({
        ...b,
        minCgpa: cutoffMap.get(b.id) ?? null,
    }));

    return NextResponse.json({
        blockCutoffsEnabled: session.blockCutoffsEnabled,
        maxCgpaDiffEnabled: session.maxCgpaDiffEnabled,
        maxCgpaDiff: session.maxCgpaDiff,
        blocks: blocksWithCutoffs,
    });
}

// PATCH /api/sessions/[sessionId]/settings
// Body: { blockCutoffsEnabled?, maxCgpaDiffEnabled?, maxCgpaDiff?, cutoffs?: [{blockId, minCgpa}] }
export async function PATCH(request, { params }) {
    try {
        const sessionId = parseInt(params.sessionId);
        if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });

        const body = await request.json();
        const { blockCutoffsEnabled, maxCgpaDiffEnabled, maxCgpaDiff, cutoffs } = body;

        // Only allow changes on DRAFT sessions
        const session = await prisma.allotmentSession.findUnique({
            where: { id: sessionId },
            select: { status: true, portalStatus: true },
        });
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        if (session.status !== 'DRAFT') {
            return NextResponse.json({ error: 'Algorithm rules can only be changed on a DRAFT session.' }, { status: 400 });
        }
        if (session.portalStatus !== 'CLOSED') {
            return NextResponse.json({ error: 'Algorithm rules can only be changed when the student portal is CLOSED.' }, { status: 400 });
        }

        // Build session update payload (only include defined fields)
        const sessionUpdate = {};
        if (blockCutoffsEnabled !== undefined) sessionUpdate.blockCutoffsEnabled = blockCutoffsEnabled;
        if (maxCgpaDiffEnabled !== undefined) sessionUpdate.maxCgpaDiffEnabled = maxCgpaDiffEnabled;
        if (maxCgpaDiff !== undefined) {
            const parsed = parseFloat(maxCgpaDiff);
            sessionUpdate.maxCgpaDiff = (maxCgpaDiff === '' || maxCgpaDiff === null || isNaN(parsed)) ? null : parsed;
        }

        await prisma.$transaction(async (tx) => {
            // Update session-level toggles
            if (Object.keys(sessionUpdate).length > 0) {
                await tx.allotmentSession.update({
                    where: { id: sessionId },
                    data: sessionUpdate,
                });
            }

            // Upsert per-block cutoffs if provided
            if (cutoffs && Array.isArray(cutoffs)) {
                for (const { blockId, minCgpa } of cutoffs) {
                    if (minCgpa === null || minCgpa === '' || isNaN(parseFloat(minCgpa))) {
                        // Remove cutoff for this block if cleared
                        await tx.blockCutoff.deleteMany({ where: { sessionId, blockId: parseInt(blockId) } });
                    } else {
                        await tx.blockCutoff.upsert({
                            where: { sessionId_blockId: { sessionId, blockId: parseInt(blockId) } },
                            create: { sessionId, blockId: parseInt(blockId), minCgpa: parseFloat(minCgpa) },
                            update: { minCgpa: parseFloat(minCgpa) },
                        });
                    }
                }
            }
        });

        return NextResponse.json({ message: 'Settings saved.' });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
