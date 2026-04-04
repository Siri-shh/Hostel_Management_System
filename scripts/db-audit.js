const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
    console.log('\n======= DATABASE AUDIT =======\n');

    // 1. Table counts
    const [
        sessions, students, studentGroups, groupMembers,
        allotments, blocks, rooms, roomTypes, blockRoomConfigs,
        portalGroups, portalGroupMembers,
    ] = await Promise.all([
        prisma.allotmentSession.count(),
        prisma.student.count(),
        prisma.studentGroup.count(),
        prisma.groupMember.count(),
        prisma.allotment.count(),
        prisma.block.count(),
        prisma.room.count(),
        prisma.roomType.count(),
        prisma.blockRoomConfig.count(),
        prisma.portalGroup.count(),
        prisma.portalGroupMember.count(),
    ]);

    console.log('--- Row Counts ---');
    console.log(`allotment_sessions:    ${sessions}`);
    console.log(`students:              ${students}`);
    console.log(`  - CSV source:        ${await prisma.student.count({ where: { source: 'CSV' } })}`);
    console.log(`  - PORTAL source:     ${await prisma.student.count({ where: { source: 'PORTAL' } })}`);
    console.log(`student_groups:        ${studentGroups}`);
    console.log(`group_members:         ${groupMembers}`);
    console.log(`allotments:            ${allotments}`);
    console.log(`blocks:                ${blocks}`);
    console.log(`rooms:                 ${rooms}`);
    console.log(`room_types:            ${roomTypes}`);
    console.log(`block_room_configs:    ${blockRoomConfigs}`);
    console.log(`portal_groups:         ${portalGroups}`);
    console.log(`portal_group_members:  ${portalGroupMembers}`);

    // 2. Session health
    console.log('\n--- Sessions ---');
    const allSessions = await prisma.allotmentSession.findMany({
        include: { _count: { select: { students: true, groups: true, allotments: true, portalGroups: true } } },
        orderBy: { createdAt: 'desc' },
    });
    for (const s of allSessions) {
        console.log(`  [${s.id}] "${s.name}" | status=${s.status} | portal=${s.portalStatus} | students=${s._count.students} | groups=${s._count.groups} | allotments=${s._count.allotments} | portalGroups=${s._count.portalGroups}`);
    }

    // 3. Orphan checks
    console.log('\n--- Orphan / Integrity Checks ---');

    // Students with password but source=CSV (wrong)
    const csvWithPwd = await prisma.student.count({ where: { source: 'CSV', NOT: { password: null } } });
    console.log(`CSV students with a password set (should be 0): ${csvWithPwd}`);

    // GroupMembers pointing to non-existent students
    const validStudentIds = (await prisma.student.findMany({ select: { id: true } })).map(s => s.id);
    const orphanGroupMembers = await prisma.groupMember.count({
        where: { studentId: { notIn: validStudentIds } },
    });
    console.log(`Orphaned group_members (no matching student): ${orphanGroupMembers}`);

    // PortalGroupMembers pointing to non-existent students
    const orphanPortalMembers = await prisma.portalGroupMember.count({
        where: { studentId: { notIn: validStudentIds } },
    });
    console.log(`Orphaned portal_group_members (no matching student): ${orphanPortalMembers}`);

    // PortalGroups with no members
    const emptyPortalGroups = await prisma.portalGroup.count({
        where: { members: { none: {} } },
    });
    console.log(`Portal groups with 0 members (stale): ${emptyPortalGroups}`);

    // StudentGroups with no members
    const emptyStudentGroups = await prisma.studentGroup.count({
        where: { members: { none: {} } },
    });
    console.log(`Student groups with 0 members (stale): ${emptyStudentGroups}`);

    // Allotments with no room (non-ALLOTTED status — should be fine)
    const nullRoomAllotted = await prisma.allotment.count({
        where: { roomId: null, status: 'ALLOTTED' },
    });
    console.log(`ALLOTTED records with null roomId (should be 0): ${nullRoomAllotted}`);

    // PORTAL students with no password
    const portalNoPassword = await prisma.student.count({
        where: { source: 'PORTAL', password: null },
    });
    console.log(`PORTAL students with no password (should be 0): ${portalNoPassword}`);

    console.log('\n======= AUDIT COMPLETE =======\n');
    await prisma.$disconnect();
}

audit().catch(e => { console.error(e); process.exit(1); });
