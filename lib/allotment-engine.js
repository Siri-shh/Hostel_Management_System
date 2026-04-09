import prisma from './prisma.js';

/**
 * MIT Hostel Allotment Engine v4
 *
 * SORTING:
 *   Groups are sorted by (avgCgpa DESC, minYear ASC).
 *   CGPA is the primary criterion. Year-of-study is the tiebreaker:
 *   Year 2 > Year 3 > Year 4 (lower year number = higher priority).
 *   minYear is the smallest year in the group (so a mixed pair of Y2+Y3
 *   is treated as Y2 for priority purposes).
 *
 * ROUND 1 (Preference + Vacancy Round):
 *   For each group (highest priority first):
 *   1. Try Pref 1 (Block + Room Type)
 *   2. If Pref 1 unavailable → try Pref 2
 *   3. If mode is 'smart_vacancy' and Pref 2 also failed → Smart Vacancy Fill:
 *      Searches ALL compatible rooms, prioritising popular blocks first
 *      (Block 14 > 15 > 10 > ... for boys; Block 22 > 13 > ... for girls),
 *      filling partial rooms before empty ones.
 *   4. If still no room → WAITLISTED for Round 2.
 *
 * ROUND 2 (Waitlisted Re-process Round):
 *   Only available after admin locks Round 1 (status = ROUND1_LOCKED).
 *   The admin can disallow any R1 allotment during the verification window;
 *   disallowed rooms are freed and the group is ineligible for R2.
 *   Waitlisted groups re-sorted by the same (CGPA, year) criterion.
 *   Each group tries:
 *   1. Pref 1 again (spots may have freed, or disallowed rooms are available)
 *   2. Pref 2 again
 *   3. Smart vacancy fill (always in R2, regardless of mode)
 *   If still no room → OFF_CAMPUS.
 *
 * DESIGN:
 * - Session-aware occupancy: computed from allotment records per session.
 * - All processing in memory, then batch-written in a single transaction.
 * - Duplicate-run protection via session status checks.
 */

// Block popularity order for smart vacancy fill (higher index = tried first)
const BOYS_BLOCK_PRIORITY = [14, 15, 10, 18, 19, 20, 23];
const GIRLS_BLOCK_PRIORITY = [22, 13, 21, 8];

/**
 * Sync submitted PortalGroups → StudentGroups so the engine can process them.
 * Idempotent: skips any student already in a StudentGroup for this session.
 * Called automatically at the start of Round 1.
 */
async function syncPortalGroupsToStudentGroups(sessionId) {
    const portalGroups = await prisma.portalGroup.findMany({
        where: { sessionId, isSubmitted: true },
        include: { members: { include: { student: true } } },
    });

    const session = await prisma.allotmentSession.findUnique({
        where: { id: sessionId },
        select: { maxCgpaDiffEnabled: true, maxCgpaDiff: true },
    });

    if (portalGroups.length === 0) {
        console.log('[Sync] No submitted portal groups to sync.');
        return;
    }

    // Which students are already in a StudentGroup for this session?
    const existingMemberships = await prisma.groupMember.findMany({
        where: { group: { sessionId } },
        select: { studentId: true },
    });
    const alreadyInGroup = new Set(existingMemberships.map(m => m.studentId));

    let synced = 0, skipped = 0;
    for (const pg of portalGroups) {
        // Skip if any member is already covered by a StudentGroup
        if (pg.members.some(m => alreadyInGroup.has(m.studentId))) {
            skipped++;
            continue;
        }
        // Skip if preferences are incomplete (leader never finished setting them)
        if (!pg.pref1BlockId || !pg.pref1RoomTypeId || !pg.pref2BlockId || !pg.pref2RoomTypeId) {
            console.warn(`[Sync] Skipping portal group ${pg.id} — preferences incomplete.`);
            skipped++;
            continue;
        }

        // Skip if the group violates the Max CGPA Diff rule (catches groups that submitted before rule was enabled)
        if (session.maxCgpaDiffEnabled && session.maxCgpaDiff !== null && pg.members.length > 1) {
            const allCgpas = pg.members.map(m => m.student.cgpa);
            const diff = Math.max(...allCgpas) - Math.min(...allCgpas);
            if (diff > session.maxCgpaDiff) {
                console.warn(`[Sync] Skipping portal group ${pg.id} — CGPA diff (${diff.toFixed(2)}) exceeds max allowed (${session.maxCgpaDiff}).`);
                skipped++;
                continue;
            }
        }

        const avgCgpa = pg.members.reduce((sum, m) => sum + m.student.cgpa, 0) / pg.members.length;

        await prisma.studentGroup.create({
            data: {
                avgCgpa: Math.round(avgCgpa * 100) / 100,
                size: pg.members.length,
                pref1BlockId: pg.pref1BlockId,
                pref1RoomTypeId: pg.pref1RoomTypeId,
                pref2BlockId: pg.pref2BlockId,
                pref2RoomTypeId: pg.pref2RoomTypeId,
                sessionId,
                members: {
                    create: pg.members.map(m => ({ studentId: m.studentId })),
                },
            },
        });

        pg.members.forEach(m => alreadyInGroup.add(m.studentId));
        synced++;
    }
    console.log(`[Sync] Portal groups → StudentGroups: ${synced} synced, ${skipped} skipped.`);
}


export async function runAllotment(sessionId, round, mode = 'preference_only') {
    // --- 1. Validate session ---
    const session = await prisma.allotmentSession.findUnique({
        where: { id: sessionId },
        include: { blockCutoffs: true },
    });
    if (!session) throw new Error('Session not found');

    if (round === 1 && session.status !== 'DRAFT') {
        throw new Error('Round 1 can only run on a DRAFT session. Reset first if you want to re-run.');
    }
    if (round === 2 && session.status !== 'ROUND1_LOCKED') {
        throw new Error(session.status === 'DRAFT'
            ? 'Run Round 1 first.'
            : session.status === 'ROUND1_DONE'
                ? 'You must verify and lock Round 1 before running Round 2.'
                : 'Round 2 already completed. Reset first to re-run.');
    }

    // --- 2. Sync portal groups → student groups (Round 1 only) ---
    // Portal students form PortalGroups; we convert submitted ones to StudentGroups
    // so the engine can process them alongside CSV-uploaded groups.
    if (round === 1) {
        await syncPortalGroupsToStudentGroups(sessionId);
    }

    // --- 3. Load groups ---
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
        // Secondary sort: year tiebreaker (Year 2 > Year 3 > Year 4)
        groups.sort((a, b) => {
            if (Math.abs(b.avgCgpa - a.avgCgpa) > 0.001) return b.avgCgpa - a.avgCgpa;
            const aMinYear = Math.min(...a.members.map(m => m.student.year));
            const bMinYear = Math.min(...b.members.map(m => m.student.year));
            return aMinYear - bMinYear; // Lower year = higher priority
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
        // Secondary sort: year tiebreaker (Year 2 > Year 3 > Year 4)
        groups.sort((a, b) => {
            if (Math.abs(b.avgCgpa - a.avgCgpa) > 0.001) return b.avgCgpa - a.avgCgpa;
            const aMinYear = Math.min(...a.members.map(m => m.student.year));
            const bMinYear = Math.min(...b.members.map(m => m.student.year));
            return aMinYear - bMinYear;
        });

        // Delete R1 waitlisted records — they'll be replaced by R2 results
        await prisma.allotment.deleteMany({
            where: { sessionId, round: 1, status: 'WAITLISTED', groupId: { in: waitlistedGroupIds } },
        });
    }

    console.log(`[Allotment] Round ${round}: Processing ${groups.length} groups`);

    // Build block cutoff map (blockId → minCgpa) — empty if feature is disabled
    const blockCutoffMap = new Map();
    if (session.blockCutoffsEnabled && session.blockCutoffs.length > 0) {
        for (const c of session.blockCutoffs) {
            blockCutoffMap.set(c.blockId, c.minCgpa);
        }
        console.log(`[Allotment] Block cutoffs enabled: ${blockCutoffMap.size} block(s) have cutoffs.`);
    }

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
        if (!group.members || group.members.length === 0) {
            console.warn(`[Allotment] Skipping group ${group.id} — has no members in DB (upload likely incomplete)`);
            stats.waitlisted++;
            continue;
        }
        const groupSize = group.members.length;
        const gender = group.members[0].student.gender;
        // Minimum CGPA of any individual in the group — used for block cutoff checks
        const groupMinCgpa = Math.min(...group.members.map(m => m.student.cgpa));
        let allocated = false;

        // Helper: does this group pass the cutoff for a given blockId?
        const passesCutoff = (blockId) => {
            if (!session.blockCutoffsEnabled || blockCutoffMap.size === 0) return true;
            const cutoff = blockCutoffMap.get(blockId);
            if (!cutoff) return true; // No cutoff set for this block
            if (groupMinCgpa < cutoff) {
                console.log(`[Cutoff] Group ${group.id} (minCGPA ${groupMinCgpa}) blocked from block ${blockId} (cutoff ${cutoff})`);
                return false;
            }
            return true;
        };

        // --- Try Pref 1 ---
        if (passesCutoff(group.pref1Block.id)) {
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
        }

        // --- Try Pref 2 ---
        if (!allocated && passesCutoff(group.pref2Block.id)) {
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

        // --- Smart vacancy fill ---
        // In 'smart_vacancy' mode: active in BOTH rounds.
        // In 'preference_only' mode: only active in Round 2.
        // PASS 1: Try with block cutoffs enforced.
        // PASS 2 (fallback): Ignore cutoffs to prevent hostels from staying empty.
        if (!allocated && (mode === 'smart_vacancy' || round === 2)) {
            // Pass 1 — respects cutoffs
            const cutoffs = session.blockCutoffsEnabled ? blockCutoffMap : null;
            const vacantRoom = findSmartVacancy(
                groupSize, gender, allRooms, roomOccupancy, blockById, blockByNumber, cutoffs, groupMinCgpa
            );
            if (vacantRoom) {
                recordAllocation(group, vacantRoom, groupSize, sessionId, round, allotmentRecords, roomOccupancy);
                stats.allottedRandom++;
                stats.allottedStudents += groupSize;
                allocated = true;
            }

            // Pass 2 — cutoff override (only when Pass 1 found nothing)
            if (!allocated) {
                const vacantRoomFallback = findSmartVacancy(
                    groupSize, gender, allRooms, roomOccupancy, blockById, blockByNumber, null, null
                );
                if (vacantRoomFallback) {
                    console.log(`[Allotment] Group ${group.id} placed via cutoff-override vacancy fill (Block ${vacantRoomFallback.block?.number ?? vacantRoomFallback.blockId}).`);
                    recordAllocation(group, vacantRoomFallback, groupSize, sessionId, round, allotmentRecords, roomOccupancy);
                    stats.allottedRandom++;
                    stats.allottedStudents += groupSize;
                    allocated = true;
                }
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
            data: {
                status: round === 1 ? 'ROUND1_DONE' : 'ROUND2_DONE',
                // Save the algorithm mode used in this run (only relevant for R1)
                ...(round === 1 ? { algoMode: mode } : {}),
            },
        });
    }, { timeout: 60000, maxWait: 20000 });

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
 * Smart vacancy fill.
 *
 * Strategy:
 * 1. Collect ALL rooms matching gender where the group can fit.
 * 2. If blockCutoffMap + groupMinCgpa are provided (Pass 1), skip blocks
 *    where the group's minimum CGPA is below the cutoff.
 * 3. If called with null blockCutoffMap (Pass 2 fallback), all blocks are eligible —
 *    this prevents hostels from staying empty when no cutoff-compliant vacancy exists.
 * 4. Sort by block popularity → partial rooms first → tighter fit → lower floor.
 */
function findSmartVacancy(groupSize, gender, allRooms, roomOccupancy, blockById, blockByNumber, blockCutoffMap = null, groupMinCgpa = null) {
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

        // Block cutoff check (only applied in Pass 1 when map is provided)
        if (blockCutoffMap && groupMinCgpa !== null) {
            const cutoff = blockCutoffMap.get(room.blockId);
            if (cutoff && groupMinCgpa < cutoff) continue; // Cutoff not met — skip block
        }

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
