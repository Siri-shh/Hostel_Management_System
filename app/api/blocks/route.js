import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const blocks = await prisma.block.findMany({
            include: {
                roomConfigs: {
                    include: { roomType: true },
                },
                _count: { select: { rooms: true } },
            },
            orderBy: { number: 'asc' },
        });
        return NextResponse.json({ blocks });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
