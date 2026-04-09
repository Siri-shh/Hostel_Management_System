const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const logs = await prisma.$queryRaw`SELECT * FROM session_audit_log ORDER BY changed_at DESC LIMIT 5`;
        console.log(logs);
    } catch(e) { console.error(e) }
    await prisma.$disconnect()
}
check()
