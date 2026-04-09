import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/student/blocks — public endpoint, lists all campus blocks with capacity info
export async function GET() {
    try {
        const blocks = await prisma.block.findMany({
            include: {
                roomConfigs: { include: { roomType: true } },
                rooms: { include: { roomType: true } },
            },
            orderBy: { number: 'asc' },
        });

        const result = blocks.map(block => {
            const totalBeds = block.rooms.reduce((s, r) => s + r.roomType.capacity, 0);
            const totalRooms = block.rooms.length;
            const roomTypeBreakdown = block.roomConfigs.map(rc => ({
                id: rc.roomType.id,
                code: rc.roomType.code,
                name: rc.roomType.name,
                capacity: rc.roomType.capacity,
                roomsPerFloor: rc.roomsPerFloor,
                totalRooms: rc.roomsPerFloor * block.floors,
                totalBeds: rc.roomsPerFloor * block.floors * rc.roomType.capacity,
            }));

            return {
                id: block.id,
                number: block.number,
                gender: block.gender,
                floors: block.floors,
                totalRooms,
                totalBeds,
                roomTypeBreakdown,
            };
        });

        return NextResponse.json({ blocks: result });
    } catch (error) {
        console.error('Blocks fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
