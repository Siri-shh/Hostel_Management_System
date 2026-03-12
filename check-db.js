const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    // Find all groups in the latest session
    const latestSession = await p.allotmentSession.findFirst({ orderBy: { id: 'desc' } });
    if (!latestSession) {
        console.log("No sessions found.");
        return;
    }

    console.log(`Checking groups in Session ${latestSession.id}...`);

    const groups = await p.studentGroup.findMany({
        where: { sessionId: latestSession.id },
        include: {
            members: { include: { student: true } }
        }
    });

    let emptyGroups = 0;
    let missingStudents = 0;

    for (const g of groups) {
        if (!g.members || g.members.length === 0) {
            console.log(`Group ID ${g.id} has NO members!`);
            emptyGroups++;
        } else {
            for (const m of g.members) {
                if (!m.student) {
                    console.log(`Group ID ${g.id}, Member ID ${m.id} has NO internal student mapped!`);
                    missingStudents++;
                }
            }
        }
    }

    console.log(`\nTotal groups: ${groups.length}`);
    console.log(`Empty groups (length 0): ${emptyGroups}`);
    console.log(`Members with missing student relation: ${missingStudents}`);

    await p.$disconnect();
})();
