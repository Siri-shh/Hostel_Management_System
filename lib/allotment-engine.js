import prisma from './prisma.js';

/**
 * MIT Hostel Allotment Engine v3
 *
 * ROUND 1 (Preference Round):
 *   Groups sorted by CGPA desc. Each group tries Pref 1 → Pref 2.
 *   If neither preference has vacancies → WAITLISTED.
 *
 * ROUND 2 (Vacancy Fill Round):
 *   Waitlisted groups sorted by CGPA desc. Each group tries:
 *   1. Pref 1 again (some spots may have opened)
 *   2. Pref 2 again
 *   3. Smart vacancy fill: find ANY room matching gender + group size,
 *      prioritizing popular/high-demand blocks first, filling partial rooms
 *      before empty ones to maximize occupancy.
 *   If still no room → OFF_CAMPUS.
 *
 * Design:
 * - Session-aware occupancy: computed from allotment records per session.
 * - All processing in memory, then batch-written in a transaction.
 * - Duplicate-run protection via session status checks.
 */

// Block popularity order for smart vacancy fill (higher index = tried first)
const BOYS_BLOCK_PRIORITY = [14, 15, 10, 18, 19, 20, 23];
const GIRLS_BLOCK_PRIORITY = [22, 13, 21, 8];

export async function runAllotment(sessionId, round) {
    // --- 1. Validate session ---
    const session = await prisma.allotmentSession.findUnique({
        where: { id: sessionId },
    });
    if (!session) throw new Error('Session not found');

    if (round === 1 && session.status !== 'DRAFT') {
        throw new Error('Round 1 can only run on a DRAFT session. Reset first if you want to re-run.');
    }
    if (round === 2 && session.status !== 'ROUND1_DONE') {
        throw new Error(session.status === 'DRAFT'
            ? 'Run Round 1 first.'
            : 'Round 2 already completed. Reset first to re-run.');
    }

    // --- 2. Load groups ---
    let groups;
    if (round === 1) {
        groups = await prisma.studentGroup.findMany({
            where: { sessionId },
            include: {
                members: { include: { student: true } },
                pref1Block: true, pref1RoomType: true,
                pref2Block: true, pref2RoomType: true,
            },
            orderBy: { avgCgpa: 'desc' },
        });
    } else {
        // Round 2: get waitlisted groups
        const waitlistedAllotments = await prisma.allotment.findMany({
            where: { sessionId, round: 1, status: 'WAITLISTED' },
            select: { groupId: true },
        });
        const waitlistedGroupIds = [...new Set(waitlistedAllotments.map(a => a.groupId))];

        if (waitlistedGroupIds.length === 0) {
            await prisma.allotmentSession.update({
                where: { id: sessionId },
                data: { status: 'ROUND2_DONE' },
            });
            return makeEmptyStats(2);
        }

        groups = await prisma.studentGroup.findMany({
            where: { id: { in: waitlistedGroupIds } },
            include: {
                members: { include: { student: true } },
                pref1Block: true, pref1RoomType: true,
                pref2Block: true, pref2RoomType: true,
            },
            orderBy: { avgCgpa: 'desc' },
        });

        // Delete R1 waitlisted records — they'll be replaced by R2 results
        await prisma.allotment.deleteMany({
            where: { sessionId, round: 1, status: 'WAITLISTED', groupId: { in: waitlistedGroupIds } },
        });
    }

    console.log(`[Allotment] Round ${round}: Processing ${groups.length} groups`);

    // --- 3. Build room occupancy map (session-aware) ---
    const allRooms = await prisma.room.findMany({
        include: { block: true, roomType: true },
        orderBy: [{ blockId: 'asc' }, { floor: 'asc' }, { roomNumber: 'asc' }],
    });

    const existingAllotments = await prisma.allotment.findMany({
        where: { sessionId, status: 'ALLOTTED' },
        select: { roomId: true },
    });

    // roomId -> occupied bed count
    const roomOccupancy = new Map();
    for (const room of allRooms) {
        roomOccupancy.set(room.id, 0);
    }
    for (const a of existingAllotments) {
        if (a.roomId) {
            roomOccupancy.set(a.roomId, (roomOccupancy.get(a.roomId) || 0) + 1);
        }
    }

    // Lookup maps
    const roomsByBlockAndType = new Map();
    for (const room of allRooms) {
        const key = `${room.blockId}-${room.roomTypeId}`;
        if (!roomsByBlockAndType.has(key)) roomsByBlockAndType.set(key, []);
        roomsByBlockAndType.get(key).push(room);
    }

    const blockById = new Map();
    const blockByNumber = new Map();
    for (const room of allRooms) {
        blockById.set(room.blockId, room.block);
        blockByNumber.set(room.block.number, room.block);
    }

    // --- 4. Allocate ---
    const stats = {
        round,
        totalGroups: groups.length,
        totalStudents: groups.reduce((sum, g) => sum + g.members.length, 0),
        allottedPref1: 0,
        allottedPref2: 0,
        allottedRandom: 0,
        waitlisted: 0,
        allottedStudents: 0,
        waitlistedStudents: 0,
    };

    const allotmentRecords = [];

    for (const group of groups) {
        const groupSize = group.members.length;
        const gender = group.members[0].student.gender;
        let allocated = false;

        // --- Try Pref 1 ---
        const room1 = findRoom(
            group.pref1Block.id, group.pref1RoomType.id, group.pref1RoomType.capacity,
            groupSize, gender, roomsByBlockAndType, roomOccupancy, blockById
        );
        if (room1) {
            recordAllocation(group, room1, groupSize, sessionId, round, allotmentRecords, roomOccupancy);
            stats.allottedPref1++;
            stats.allottedStudents += groupSize;
            allocated = true;
        }

        // --- Try Pref 2 ---
        if (!allocated) {
            const room2 = findRoom(
                group.pref2Block.id, group.pref2RoomType.id, group.pref2RoomType.capacity,
                groupSize, gender, roomsByBlockAndType, roomOccupancy, blockById
            );
            if (room2) {
                recordAllocation(group, room2, groupSize, sessionId, round, allotmentRecords, roomOccupancy);
                stats.allottedPref2++;
                stats.allottedStudents += groupSize;
                allocated = true;
            }
        }

        // --- Round 2 ONLY: Smart vacancy fill ---
        if (!allocated && round === 2) {
            const vacantRoom = findSmartVacancy(
                groupSize, gender, allRooms, roomOccupancy, blockById, blockByNumber
            );
            if (vacantRoom) {
                recordAllocation(group, vacantRoom, groupSize, sessionId, round, allotmentRecords, roomOccupancy);
                stats.allottedRandom++;
                stats.allottedStudents += groupSize;
                allocated = true;
            }
        }

        // --- Not placed ---
        if (!allocated) {
            const status = round === 1 ? 'WAITLISTED' : 'OFF_CAMPUS';
            for (const member of group.members) {
                allotmentRecords.push({
                    studentId: member.studentId,
                    roomId: null,
                    groupId: group.id,
                    round,
                    status,
                    sessionId,
                });
            }
            stats.waitlisted++;
            stats.waitlistedStudents += groupSize;
        }
    }

    console.log(`[Allotment] Round ${round} results: Pref1=${stats.allottedPref1}, Pref2=${stats.allottedPref2}, Random=${stats.allottedRandom}, Waitlisted=${stats.waitlisted}`);
    console.log(`[Allotment] Students: Allotted=${stats.allottedStudents}, Waitlisted/Off=${stats.waitlistedStudents}`);

    // --- 5. Write to DB in transaction ---
    const BATCH = 500;
    await prisma.$transaction(async (tx) => {
        for (let i = 0; i < allotmentRecords.length; i += BATCH) {
            await tx.allotment.createMany({
                data: allotmentRecords.slice(i, i + BATCH),
            });
        }
        await tx.allotmentSession.update({
            where: { id: sessionId },
            data: { status: round === 1 ? 'ROUND1_DONE' : 'ROUND2_DONE' },
        });
    });

    return stats;
}


/**
 * Find a room in a specific block + room type combination.
 */
function findRoom(blockId, roomTypeId, roomCapacity, groupSize, gender, roomsByBlockAndType, roomOccupancy, blockById) {
    if (groupSize > roomCapacity) return null;

    const block = blockById.get(blockId);
    if (!block || block.gender !== gender) return null;

    const key = `${blockId}-${roomTypeId}`;
    const rooms = roomsByBlockAndType.get(key);
    if (!rooms) return null;

    // Try partially occupied rooms first (fill most-occupied to minimize waste)
    if (groupSize < roomCapacity) {
        let bestRoom = null;
        let bestOcc = -1;
        for (const room of rooms) {
            const occ = roomOccupancy.get(room.id) || 0;
            if (occ > 0 && (occ + groupSize) <= roomCapacity && occ > bestOcc) {
                bestRoom = room;
                bestOcc = occ;
            }
        }
        if (bestRoom) return bestRoom;
    }

    // Then empty rooms
    for (const room of rooms) {
        if ((roomOccupancy.get(room.id) || 0) === 0) return room;
    }

    return null;
}


/**
 * Smart vacancy fill for Round 2.
 *
 * Strategy:
 * 1. Collect ALL rooms matching gender where the group can fit
 * 2. Sort by priority:
 *    a. Popular blocks first (Block 14 > 15 > ... for boys; 22 > 13 > ... for girls)
 *    b. Within a block: partial rooms first (to complete them), then empty rooms
 *    c. Within those: higher floors first (usually preferred)
 * 3. Return the best match
 */
function findSmartVacancy(groupSize, gender, allRooms, roomOccupancy, blockById, blockByNumber) {
    const priorityOrder = gender === 'MALE' ? BOYS_BLOCK_PRIORITY : GIRLS_BLOCK_PRIORITY;

    // Create a priority map: blockNumber -> priority (lower = better)
    const blockPriority = new Map();
    priorityOrder.forEach((bn, idx) => blockPriority.set(bn, idx));

    // Collect candidate rooms
    const candidates = [];
    for (const room of allRooms) {
        const block = blockById.get(room.blockId);
        if (!block || block.gender !== gender) continue;
        if (room.roomType.capacity < groupSize) continue;

        const occ = roomOccupancy.get(room.id) || 0;
        const remaining = room.roomType.capacity - occ;
        if (remaining < groupSize) continue; // Not enough space

        candidates.push({
            room,
            blockNumber: block.number,
            occ,
            remaining,
            capacity: room.roomType.capacity,
            priority: blockPriority.get(block.number) ?? 999,
        });
    }

    if (candidates.length === 0) return null;

    // Sort candidates:
    // 1. Block priority (popular blocks first)
    // 2. Partial rooms before empty (complete them first)
    // 3. Less remaining space first (pack tighter)
    // 4. Lower floor first (for orderly filling)
    candidates.sort((a, b) => {
        // Popular blocks first
        if (a.priority !== b.priority) return a.priority - b.priority;
        // Partial rooms first (occ > 0 ranks higher)
        const aPartial = a.occ > 0 ? 0 : 1;
        const bPartial = b.occ > 0 ? 0 : 1;
        if (aPartial !== bPartial) return aPartial - bPartial;
        // Less remaining space first (pack tighter)
        if (a.remaining !== b.remaining) return a.remaining - b.remaining;
        // Lower floor, lower room number
        if (a.room.floor !== b.room.floor) return a.room.floor - b.room.floor;
        return a.room.roomNumber.localeCompare(b.room.roomNumber);
    });

    return candidates[0].room;
}


/**
 * Record an allocation in memory.
 */
function recordAllocation(group, room, groupSize, sessionId, round, allotmentRecords, roomOccupancy) {
    for (const member of group.members) {
        allotmentRecords.push({
            studentId: member.studentId,
            roomId: room.id,
            groupId: group.id,
            round,
            status: 'ALLOTTED',
            sessionId,
        });
    }
    roomOccupancy.set(room.id, (roomOccupancy.get(room.id) || 0) + groupSize);
}


function makeEmptyStats(round) {
    return {
        round,
        totalGroups: 0,
        totalStudents: 0,
        allottedPref1: 0,
        allottedPref2: 0,
        allottedRandom: 0,
        waitlisted: 0,
        allottedStudents: 0,
        waitlistedStudents: 0,
    };
}


/**
 * Get comprehensive stats for a session.
 */
export async function getSessionStats(sessionId) {
    const allotments = await prisma.allotment.findMany({
        where: { sessionId },
        include: {
            student: true,
            room: {
                include: { block: true, roomType: true },
            },
            group: true,
        },
    });

    // Load all rooms for capacity computation
    const allRooms = await prisma.room.findMany({
        include: { block: true, roomType: true },
    });

    const allottedStudents = allotments.filter(a => a.status === 'ALLOTTED');
    const waitlistedStudents = allotments.filter(a => a.status === 'WAITLISTED');
    const offCampusStudents = allotments.filter(a => a.status === 'OFF_CAMPUS');

    // Block capacity
    const blockCapacity = {};
    for (const room of allRooms) {
        const bn = room.block.number;
        if (!blockCapacity[bn]) {
            blockCapacity[bn] = { totalBeds: 0, totalRooms: 0, gender: room.block.gender };
        }
        blockCapacity[bn].totalBeds += room.roomType.capacity;
        blockCapacity[bn].totalRooms++;
    }

    // Per-block stats
    const blockStats = {};

    for (const a of allottedStudents) {
        const blockNum = a.room.block.number;
        if (!blockStats[blockNum]) {
            blockStats[blockNum] = {
                blockNumber: blockNum,
                gender: a.room.block.gender,
                allotted: 0,
                cgpaSum: 0,
                avgCgpa: 0,
                minCgpa: Infinity,
                totalBeds: blockCapacity[blockNum]?.totalBeds || 0,
                totalRooms: blockCapacity[blockNum]?.totalRooms || 0,
                occupancyPercent: 0,
                roomTypes: {},
            };
        }
        blockStats[blockNum].allotted++;
        blockStats[blockNum].cgpaSum += a.student.cgpa;
        if (a.student.cgpa < blockStats[blockNum].minCgpa) {
            blockStats[blockNum].minCgpa = a.student.cgpa;
        }

        const rtCode = a.room.roomType.code;
        if (!blockStats[blockNum].roomTypes[rtCode]) {
            blockStats[blockNum].roomTypes[rtCode] = 0;
        }
        blockStats[blockNum].roomTypes[rtCode]++;
    }

    // Include blocks with 0 allotments
    for (const [bn, cap] of Object.entries(blockCapacity)) {
        if (!blockStats[bn]) {
            blockStats[bn] = {
                blockNumber: parseInt(bn),
                gender: cap.gender,
                allotted: 0,
                cgpaSum: 0,
                avgCgpa: 0,
                minCgpa: null,
                totalBeds: cap.totalBeds,
                totalRooms: cap.totalRooms,
                occupancyPercent: 0,
                roomTypes: {},
            };
        }
    }

    for (const key of Object.keys(blockStats)) {
        const bs = blockStats[key];
        bs.avgCgpa = bs.allotted > 0 ? Math.round((bs.cgpaSum / bs.allotted) * 100) / 100 : 0;
        bs.occupancyPercent = bs.totalBeds > 0 ? Math.round((bs.allotted / bs.totalBeds) * 10000) / 100 : 0;
        if (bs.minCgpa === Infinity) bs.minCgpa = null;
        delete bs.cgpaSum;
    }

    // Block-wise room-student data
    const blockRoomData = {};
    for (const a of allottedStudents) {
        const bn = a.room.block.number;
        if (!blockRoomData[bn]) blockRoomData[bn] = {};

        const roomKey = a.room.roomNumber;
        if (!blockRoomData[bn][roomKey]) {
            blockRoomData[bn][roomKey] = {
                roomNumber: a.room.roomNumber,
                floor: a.room.floor,
                roomType: a.room.roomType.code,
                capacity: a.room.roomType.capacity,
                occupants: [],
            };
        }
        blockRoomData[bn][roomKey].occupants.push({
            regNo: a.student.regNo,
            name: a.student.name,
            cgpa: a.student.cgpa,
            gender: a.student.gender,
            year: a.student.year,
            department: a.student.department,
            round: a.round,
        });
    }

    const blockRoomDataSorted = {};
    for (const [bn, rooms] of Object.entries(blockRoomData)) {
        blockRoomDataSorted[bn] = Object.values(rooms).sort((a, b) => {
            if (a.floor !== b.floor) return a.floor - b.floor;
            return a.roomNumber.localeCompare(b.roomNumber);
        });
    }

    // Room type stats
    const roomTypeStats = {};
    for (const a of allottedStudents) {
        const rtCode = a.room.roomType.code;
        if (!roomTypeStats[rtCode]) {
            roomTypeStats[rtCode] = { code: rtCode, name: a.room.roomType.name, count: 0 };
        }
        roomTypeStats[rtCode].count++;
    }

    // Year distribution
    const yearStats = {};
    for (const a of allottedStudents) {
        if (!yearStats[a.student.year]) yearStats[a.student.year] = 0;
        yearStats[a.student.year]++;
    }

    // Gender split
    const genderStats = { MALE: 0, FEMALE: 0 };
    for (const a of allottedStudents) {
        genderStats[a.student.gender]++;
    }

    // Round stats
    const round1Allotted = allottedStudents.filter(a => a.round === 1).length;
    const round2Allotted = allottedStudents.filter(a => a.round === 2).length;

    return {
        total: allotments.length,
        allotted: allottedStudents.length,
        waitlisted: waitlistedStudents.length,
        offCampus: offCampusStudents.length,
        round1Allotted,
        round2Allotted,
        blockStats: Object.values(blockStats).sort((a, b) => a.blockNumber - b.blockNumber),
        blockRoomData: blockRoomDataSorted,
        roomTypeStats: Object.values(roomTypeStats),
        yearStats,
        genderStats,
        allottedList: allottedStudents.map(a => ({
            regNo: a.student.regNo,
            name: a.student.name,
            gender: a.student.gender,
            year: a.student.year,
            department: a.student.department,
            cgpa: a.student.cgpa,
            block: a.room.block.number,
            roomNumber: a.room.roomNumber,
            roomType: a.room.roomType.code,
            round: a.round,
        })),
        waitlistedList: waitlistedStudents.map(a => ({
            regNo: a.student.regNo,
            name: a.student.name,
            gender: a.student.gender,
            year: a.student.year,
            department: a.student.department,
            cgpa: a.student.cgpa,
        })),
        offCampusList: offCampusStudents.map(a => ({
            regNo: a.student.regNo,
            name: a.student.name,
            gender: a.student.gender,
            year: a.student.year,
            department: a.student.department,
            cgpa: a.student.cgpa,
        })),
    };
}
