const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const session = await p.allotmentSession.findFirst({ orderBy: { id: 'desc' } });
    if (!session) return;

    for (const targetBlock of [14, 15]) {
        console.log(`\n========================================`);
        console.log(`ANALYSIS FOR BLOCK ${targetBlock}`);
        console.log(`========================================`);

        const allotments = await p.allotment.findMany({
            where: {
                sessionId: session.id,
                status: 'ALLOTTED',
                room: { block: { number: targetBlock } }
            },
            include: {
                student: true,
                group: true,
                room: { include: { roomType: true } }
            },
            orderBy: { student: { cgpa: 'asc' } }
        });

        if (allotments.length === 0) {
            console.log('No allotments found.');
            continue;
        }

        const total = allotments.length;
        const avg = allotments.reduce((sum, a) => sum + a.student.cgpa, 0) / total;
        
        console.log(`Total students placed: ${total}`);
        console.log(`Block Average CGPA: ${avg.toFixed(2)}`);
        
        console.log(`\n--- THE "CUTOFF" (Bottom 15 students) ---`);
        const bottom = allotments.slice(0, 15);
        for (const a of bottom) {
            console.log(`  CGPA: ${a.student.cgpa.toFixed(2)} | Group Size: ${a.group.size} | Room Type: ${a.room.roomType.code} | Round: ${a.round} | Status: ${a.round===1 ? 'Preference' : 'Random Vacancy Fill'}`);
        }

        console.log(`\n--- Top 5 students for comparison ---`);
        const top = allotments.slice(-5).reverse();
        for (const a of top) {
            console.log(`  CGPA: ${a.student.cgpa.toFixed(2)} | Group Size: ${a.group.size} | Room Type: ${a.room.roomType.code} | Round: ${a.round}`);
        }
    }
    
    await p.$disconnect();
})();
