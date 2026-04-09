import { NextResponse } from 'next/server';
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

        // We only want ALLOTTED records from Round 1 for the verification panel.
        // If a group was waitlisted or already disallowed, we don't show them here.
        const allotments = await prisma.allotment.findMany({
            where: {
                sessionId,
                round: 1,
                status: 'ALLOTTED',
            },
            include: {
                student: true,
                room: {
                    include: { block: true, roomType: true },
                },
                group: {
                    select: {
                        pref1BlockId: true,
                        pref1RoomTypeId: true,
                        pref2BlockId: true,
                        pref2RoomTypeId: true,
                    }
                }
            },
            orderBy: [
                { room: { blockId: 'asc' } },
                { room: { floor: 'asc' } },
                { room: { roomNumber: 'asc' } },
            ],
        });

        // Compute 'placedBy' directly so frontend doesn't have to guess
        const enriched = allotments.map(a => {
            let placedBy = 'vacancy';
            if (a.room && a.group) {
                if (a.room.blockId === a.group.pref1BlockId && a.room.roomTypeId === a.group.pref1RoomTypeId) {
                    placedBy = 'pref1';
                } else if (a.room.blockId === a.group.pref2BlockId && a.room.roomTypeId === a.group.pref2RoomTypeId) {
                    placedBy = 'pref2';
                }
            }
            return {
                ...a,
                placedBy,
            };
        });

        return NextResponse.json({ allotments: enriched });
    } catch (error) {
        console.error('Fetch R1 allotments error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
