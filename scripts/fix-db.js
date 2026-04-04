const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDB() {
    console.log('\n======= DB CLEANUP & FIX =======\n');

    // 1. Nullify stale passwords on CSV-source students
    // These were set during pre-refactor testing when the old portal wrote passwords
    // directly onto Student records without the source distinction.
    const clearedPasswords = await prisma.student.updateMany({
        where: { source: 'CSV', NOT: { password: null } },
        data: { password: null },
    });
    console.log(`✅ Cleared stale passwords from ${clearedPasswords.count} CSV student(s).`);

    // 2. Delete orphaned StudentGroups (those with no GroupMember rows).
    // These were left over from before the PortalStudent refactor migration
    // (db push --accept-data-loss dropped the old group_members data).
    // Without members, the allotment engine skips them anyway.
    const orphanedGroups = await prisma.studentGroup.findMany({
        where: { members: { none: {} } },
        select: { id: true },
    });
    const orphanedGroupIds = orphanedGroups.map(g => g.id);

    if (orphanedGroupIds.length > 0) {
        const deleted = await prisma.studentGroup.deleteMany({
            where: { id: { in: orphanedGroupIds } },
        });
        console.log(`✅ Deleted ${deleted.count} orphaned StudentGroups (no members, allotment would have skipped them).`);
        console.log(`   ⚠️  The CSV for session [5] needs to be re-uploaded to restore group-member links.`);
    } else {
        console.log('✅ No orphaned StudentGroups found.');
    }

    // 3. Summary check
    console.log('\n--- Post-Fix State ---');
    console.log(`Students:              ${await prisma.student.count()}`);
    console.log(`  CSV with password:   ${await prisma.student.count({ where: { source: 'CSV', NOT: { password: null } } })}`);
    console.log(`  PORTAL source:       ${await prisma.student.count({ where: { source: 'PORTAL' } })}`);
    console.log(`StudentGroups:         ${await prisma.studentGroup.count()}`);
    console.log(`GroupMembers:          ${await prisma.groupMember.count()}`);
    console.log(`PortalGroups:          ${await prisma.portalGroup.count()}`);
    console.log(`Allotments:            ${await prisma.allotment.count()}`);
    console.log('\n======= DONE =======\n');

    await prisma.$disconnect();
}

fixDB().catch(e => { console.error(e); process.exit(1); });
