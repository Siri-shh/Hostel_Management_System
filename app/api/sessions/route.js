import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const sessions = await prisma.allotmentSession.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { students: true, allotments: true } },
            },
        });
        return NextResponse.json({ sessions });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
        }
        const session = await prisma.allotmentSession.create({
            data: { name },
        });
        return NextResponse.json({ session });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
