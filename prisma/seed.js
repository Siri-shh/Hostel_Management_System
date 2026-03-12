const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ROOM_TYPES = [
    { code: 'SA', name: 'Single Attached Non-AC', capacity: 1 },
    { code: 'SAC', name: 'Single Attached AC', capacity: 1 },
    { code: 'SC', name: 'Single Non-Attached Non-AC', capacity: 1 },
    { code: 'DA', name: 'Double Attached Non-AC', capacity: 2 },
    { code: 'DAC', name: 'Double Attached AC', capacity: 2 },
    { code: 'DC', name: 'Double Non-Attached Non-AC', capacity: 2 },
    { code: 'QAC', name: 'Quadruple Attached AC', capacity: 4 },
];

const BLOCK_CONFIGS = [
    { number: 8, gender: 'FEMALE', roomTypes: ['DA', 'DAC'] },
    { number: 10, gender: 'MALE', roomTypes: ['DC', 'SAC', 'SC'] },
    { number: 13, gender: 'FEMALE', roomTypes: ['DA', 'DAC', 'SA', 'SAC'] },
    { number: 14, gender: 'MALE', roomTypes: ['DAC', 'SAC'] },
    { number: 15, gender: 'MALE', roomTypes: ['DAC', 'SAC'] },
    { number: 18, gender: 'MALE', roomTypes: ['SA', 'SAC'] },
    { number: 19, gender: 'MALE', roomTypes: ['SA', 'SAC'] },
    { number: 20, gender: 'MALE', roomTypes: ['SA', 'SAC'] },
    { number: 21, gender: 'FEMALE', roomTypes: ['SA', 'SAC'] },
    { number: 22, gender: 'FEMALE', roomTypes: ['DAC'] },
    { number: 23, gender: 'MALE', roomTypes: ['DAC', 'QAC', 'SAC'] },
];

const DEFAULT_FLOORS = 8;
const DEFAULT_ROOMS_PER_FLOOR = 30;

async function main() {
    console.log('🏗️  Seeding database...\n');

    // 1. Upsert room types
    const roomTypeMap = {};
    for (const rt of ROOM_TYPES) {
        const created = await prisma.roomType.upsert({
            where: { code: rt.code },
            update: { name: rt.name, capacity: rt.capacity },
            create: rt,
        });
        roomTypeMap[rt.code] = created;
        console.log(`  ✅ Room type: ${rt.code} (capacity ${rt.capacity})`);
    }

    // 2. Upsert blocks and create rooms
    for (const bc of BLOCK_CONFIGS) {
        const block = await prisma.block.upsert({
            where: { number: bc.number },
            update: { gender: bc.gender, floors: DEFAULT_FLOORS, roomsPerFloor: DEFAULT_ROOMS_PER_FLOOR },
            create: {
                number: bc.number,
                gender: bc.gender,
                floors: DEFAULT_FLOORS,
                roomsPerFloor: DEFAULT_ROOMS_PER_FLOOR,
            },
        });

        const typesCount = bc.roomTypes.length;
        const roomsPerType = Math.floor(DEFAULT_ROOMS_PER_FLOOR / typesCount);
        const remainder = DEFAULT_ROOMS_PER_FLOOR % typesCount;

        console.log(`\n  🏢 Block ${bc.number} (${bc.gender}) — ${typesCount} room types`);

        // Upsert block room configs
        for (let i = 0; i < bc.roomTypes.length; i++) {
            const rtCode = bc.roomTypes[i];
            const rt = roomTypeMap[rtCode];
            const perFloor = roomsPerType + (i < remainder ? 1 : 0);

            await prisma.blockRoomConfig.upsert({
                where: {
                    blockId_roomTypeId: { blockId: block.id, roomTypeId: rt.id },
                },
                update: { roomsPerFloor: perFloor },
                create: {
                    blockId: block.id,
                    roomTypeId: rt.id,
                    roomsPerFloor: perFloor,
                },
            });

            console.log(`     ${rtCode}: ${perFloor} rooms/floor × ${DEFAULT_FLOORS} floors = ${perFloor * DEFAULT_FLOORS} rooms`);
        }

        // Check if rooms already exist for this block
        const existingRooms = await prisma.room.count({ where: { blockId: block.id } });
        if (existingRooms > 0) {
            console.log(`     ⏭️  Rooms already exist (${existingRooms}), skipping room generation`);
            continue;
        }

        // Generate rooms for each floor
        const roomsToCreate = [];
        for (let floor = 1; floor <= DEFAULT_FLOORS; floor++) {
            let roomNum = 1;
            for (let i = 0; i < bc.roomTypes.length; i++) {
                const rtCode = bc.roomTypes[i];
                const rt = roomTypeMap[rtCode];
                const perFloor = roomsPerType + (i < remainder ? 1 : 0);

                for (let r = 0; r < perFloor; r++) {
                    const roomNumber = `${floor}${String(roomNum).padStart(2, '0')}`;
                    roomsToCreate.push({
                        blockId: block.id,
                        roomTypeId: rt.id,
                        floor: floor,
                        roomNumber: roomNumber,
                        occupiedBeds: 0,
                    });
                    roomNum++;
                }
            }
        }

        await prisma.room.createMany({ data: roomsToCreate });
        console.log(`     🛏️  Created ${roomsToCreate.length} rooms`);
    }

    // 3. Summary
    const totalBlocks = await prisma.block.count();
    const totalRooms = await prisma.room.count();
    const totalConfigs = await prisma.blockRoomConfig.count();

    console.log(`\n🎉 Seeding complete!`);
    console.log(`   ${totalBlocks} blocks, ${totalRooms} rooms, ${totalConfigs} room configs`);
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
