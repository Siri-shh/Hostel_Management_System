const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const s = await prisma.allotmentSession.findFirst({ orderBy: { id: 'desc' } });
        console.log("Using session id:", s.id);

        const res = await fetch(`http://localhost:3000/api/sessions/${s.id}/settings`, { 
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blockCutoffsEnabled: false,
                maxCgpaDiffEnabled: true,
                maxCgpaDiff: 1.5,
                cutoffs: []
            })
        });
        const text = await res.text();
        console.log("STATUS:", res.status);
        console.log("TEXT:", text);

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
