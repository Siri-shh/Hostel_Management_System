// Block and room type configuration for MIT Hostel System

export const ROOM_TYPES = [
    { code: 'SA', name: 'Single Attached Non-AC', capacity: 1 },
    { code: 'SAC', name: 'Single Attached AC', capacity: 1 },
    { code: 'SC', name: 'Single Non-Attached Non-AC', capacity: 1 },
    { code: 'DA', name: 'Double Attached Non-AC', capacity: 2 },
    { code: 'DAC', name: 'Double Attached AC', capacity: 2 },
    { code: 'DC', name: 'Double Non-Attached Non-AC', capacity: 2 },
    { code: 'QAC', name: 'Quadruple Attached AC', capacity: 4 },
];

// In-scope blocks (Year 2-4 students only)
// Blocks 1-7, 9, 11, 12, 16, 17 are first-year-only and excluded
export const BLOCK_CONFIGS = [
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

export const DEFAULT_FLOORS = 8;
export const DEFAULT_ROOMS_PER_FLOOR = 30;

// Gender label helpers
export function genderLabel(g) {
    return g === 'MALE' ? 'Boys' : 'Girls';
}

// Get room type capacity by code
export function getRoomCapacity(code) {
    const rt = ROOM_TYPES.find(r => r.code === code);
    return rt ? rt.capacity : null;
}

// Get valid blocks for a given gender
export function getBlocksForGender(gender) {
    return BLOCK_CONFIGS.filter(b => b.gender === gender);
}

// Check if a room type is valid for a block
export function isValidRoomTypeForBlock(blockNumber, roomTypeCode) {
    const block = BLOCK_CONFIGS.find(b => b.number === blockNumber);
    return block ? block.roomTypes.includes(roomTypeCode) : false;
}

// Check if a block matches a gender
export function isBlockForGender(blockNumber, gender) {
    const block = BLOCK_CONFIGS.find(b => b.number === blockNumber);
    return block ? block.gender === gender : false;
}
