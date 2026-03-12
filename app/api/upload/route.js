import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateCSV } from '@/lib/csv-validator';

const BATCH_SIZE = 500;

export async function POST(request) {
    try {
        const { rows, sessionName } = await request.json();
        if (!rows || !Array.isArray(rows) || !sessionName) {
            return NextResponse.json({ error: 'Invalid data — need rows array and sessionName' }, { status: 400 });
        }

        // Validate first
        const validation = validateCSV(rows);
        if (!validation.valid) {
            return NextResponse.json({
                error: 'Validation failed',
                errors: validation.errors,
            }, { status: 400 });
        }

        // Create session
        const session = await prisma.allotmentSession.create({
            data: { name: sessionName },
        });

        // Load block and room type lookups
        const blocks = await prisma.block.findMany();
        const roomTypes = await prisma.roomType.findMany();
        const blockMap = Object.fromEntries(blocks.map(b => [b.number, b]));
        const rtMap = Object.fromEntries(roomTypes.map(rt => [rt.code, rt]));

        // --- Batch-insert students (now with preferences) ---
        const studentDataList = validation.students.map(s => ({
            regNo: s.regNo,
            name: s.name,
            gender: s.gender,
            year: s.year,
            department: s.department,
            cgpa: s.cgpa,
            sessionId: session.id,
            // Store raw preferences so allotment engine can use them directly
            pref1BlockNum: s.pref1Block,
            pref1RoomTypeCode: s.pref1RoomType,
            pref2BlockNum: s.pref2Block,
            pref2RoomTypeCode: s.pref2RoomType,
        }));

        for (let i = 0; i < studentDataList.length; i += BATCH_SIZE) {
            await prisma.student.createMany({
                data: studentDataList.slice(i, i + BATCH_SIZE),
            });
        }

        // Fetch all created students to get their DB IDs
        const createdStudents = await prisma.student.findMany({
            where: { sessionId: session.id },
            select: { id: true, regNo: true },
        });
        const studentByReg = Object.fromEntries(createdStudents.map(s => [s.regNo, s]));

        // --- Create groups ---
        let groupCount = 0;
        let groupSkipped = 0;
        const allGroupMemberData = [];

        console.log(`[Upload] Total groups from validation: ${validation.groups.length}`);

        for (const group of validation.groups) {
            const leader = group.members[0];
            const pref1Block = blockMap[leader.pref1Block];
            const pref1RT = rtMap[leader.pref1RoomType];
            const pref2Block = blockMap[leader.pref2Block];
            const pref2RT = rtMap[leader.pref2RoomType];

            if (!pref1Block || !pref1RT || !pref2Block || !pref2RT) {
                // Log the failure for debugging
                if (groupSkipped < 5) {
                    console.warn(`[Upload] Skipping group (leader: ${leader.regNo}): ` +
                        `pref1Block=${leader.pref1Block}→${pref1Block ? 'OK' : 'MISSING'}, ` +
                        `pref1RT=${leader.pref1RoomType}→${pref1RT ? 'OK' : 'MISSING'}, ` +
                        `pref2Block=${leader.pref2Block}→${pref2Block ? 'OK' : 'MISSING'}, ` +
                        `pref2RT=${leader.pref2RoomType}→${pref2RT ? 'OK' : 'MISSING'}`);
                }
                groupSkipped++;
                continue;
            }

            const studentGroup = await prisma.studentGroup.create({
                data: {
                    avgCgpa: group.avgCgpa,
                    size: group.size,
                    pref1BlockId: pref1Block.id,
                    pref1RoomTypeId: pref1RT.id,
                    pref2BlockId: pref2Block.id,
                    pref2RoomTypeId: pref2RT.id,
                    sessionId: session.id,
                },
            });

            for (const member of group.members) {
                const dbStudent = studentByReg[member.regNo];

                if (dbStudent) {
                    allGroupMemberData.push({
                        groupId: studentGroup.id,
                        studentId: dbStudent.id,
                    });
                }
            }
            groupCount++;
        }

        if (groupSkipped > 0) {
            console.warn(`[Upload] WARNING: ${groupSkipped} groups skipped due to failed block/RT lookups!`);
        }
        console.log(`[Upload] Created ${groupCount} groups, skipped ${groupSkipped}`);

        // Batch-insert all group members
        if (allGroupMemberData.length > 0) {
            for (let i = 0; i < allGroupMemberData.length; i += BATCH_SIZE) {
                await prisma.groupMember.createMany({
                    data: allGroupMemberData.slice(i, i + BATCH_SIZE),
                });
            }
        }

        return NextResponse.json({
            sessionId: session.id,
            sessionName: session.name,
            studentCount: studentDataList.length,
            groupCount,
            groupSkipped,
            warning: groupSkipped > 0 ? `${groupSkipped} groups could not be created due to block/room type lookup failures. Check server logs.` : undefined,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
