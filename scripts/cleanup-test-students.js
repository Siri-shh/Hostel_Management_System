const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    // Delete all PORTAL-source students that were created during testing
    const deleted = await prisma.student.deleteMany({
        where: { source: 'PORTAL' },
    });
    console.log(`Deleted ${deleted.count} portal/test student(s).`);
    await prisma.$disconnect();
}

cleanup().catch(e => { console.error(e); process.exit(1); });
