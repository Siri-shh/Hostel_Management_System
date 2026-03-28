import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET(request, { params }) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const blockNum = searchParams.get('blockNum');
        const limitParam = searchParams.get('limit');
        const { sessionId: sessionIdStr } = await params;
        const sessionId = parseInt(sessionIdStr);

        if (isNaN(sessionId)) return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });

        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        let data = [];
        let filename = `export_session_${sessionId}_${type}.csv`;

        if (type === 'all' || type === 'round1' || type === 'round2' || type === 'block' || type === 'pref1' || type === 'pref2') {
            const whereClause = { sessionId, status: 'ALLOTTED' };
            if (type === 'round1') whereClause.round = 1;
            if (type === 'round2') whereClause.round = 2;
            if (type === 'block' && blockNum) {
                whereClause.room = { block: { number: parseInt(blockNum) } };
                filename = `export_session_${sessionId}_block_${blockNum}.csv`;
            }

            const allotments = await prisma.allotment.findMany({
                where: whereClause,
                include: {
                    student: true,
                    room: { include: { block: true, roomType: true } },
                    group: { include: { pref1Block: true, pref1RoomType: true, pref2Block: true, pref2RoomType: true } }
                },
                orderBy: { student: { cgpa: 'desc' } }
            });

            // Filter for custom pref matches if needed
            let filtered = allotments;
            if (type === 'pref1') {
                filtered = allotments.filter(a =>
                    a.room.blockId === a.group.pref1BlockId &&
                    a.room.roomTypeId === a.group.pref1RoomTypeId
                );
            } else if (type === 'pref2') {
                filtered = allotments.filter(a =>
                    a.room.blockId === a.group.pref2BlockId &&
                    a.room.roomTypeId === a.group.pref2RoomTypeId
                );
            }

            data = filtered.map(a => ({
                'Reg No': a.student.regNo,
                'Name': a.student.name,
                'Gender': a.student.gender,
                'Year': a.student.year,
                'Department': a.student.department,
                'CGPA': a.student.cgpa,
                'Allotted Block': `Block ${a.room.block.number}`,
                'Allotted Room': a.room.roomNumber,
                'Room Type': a.room.roomType.code,
                'Round': `Round ${a.round}`,
                'Pref 1 Block': `Block ${a.group.pref1Block?.number || 'N/A'}`,
                'Pref 1 Type': a.group.pref1RoomType?.code || 'N/A',
                'Pref 2 Block': `Block ${a.group.pref2Block?.number || 'N/A'}`,
                'Pref 2 Type': a.group.pref2RoomType?.code || 'N/A',
                'Group Size': a.group.size
            }));

        } else if (type === 'unplaced') {
            const unplaced = await prisma.allotment.findMany({
                where: { sessionId, status: { in: ['WAITLISTED', 'OFF_CAMPUS'] } },
                include: { student: true, group: { include: { pref1Block: true, pref1RoomType: true, pref2Block: true, pref2RoomType: true } } },
                orderBy: { student: { cgpa: 'desc' } }
            });

            data = unplaced.map(a => ({
                'Reg No': a.student.regNo,
                'Name': a.student.name,
                'Gender': a.student.gender,
                'Year': a.student.year,
                'Department': a.student.department,
                'CGPA': a.student.cgpa,
                'Status': a.status,
                'Group Size': a.group.size,
                'Pref 1 Block': `Block ${a.group.pref1Block?.number || 'N/A'}`,
                'Pref 1 Type': a.group.pref1RoomType?.code || 'N/A',
                'Pref 2 Block': `Block ${a.group.pref2Block?.number || 'N/A'}`,
                'Pref 2 Type': a.group.pref2RoomType?.code || 'N/A',
            }));
        }

        if (limitParam) {
            data = data.slice(0, parseInt(limitParam));
        }

        const csvString = Papa.unparse(data);

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
