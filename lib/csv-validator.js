import {
    BLOCK_CONFIGS, ROOM_TYPES,
    isValidRoomTypeForBlock, isBlockForGender, getRoomCapacity,
} from './constants.js';

/**
 * Validate a parsed CSV dataset.
 * Returns { valid: boolean, errors: string[], students: object[], warnings: string[] }
 */
export function validateCSV(rows) {
    const errors = [];
    const warnings = [];
    const students = [];
    const regNos = new Set();

    if (!rows || rows.length === 0) {
        return { valid: false, errors: ['CSV is empty'], students: [], warnings: [] };
    }

    // Check required columns
    const requiredCols = [
        'reg_no', 'name', 'gender', 'year', 'department', 'cgpa',
        'pref1_block', 'pref1_room_type', 'pref2_block', 'pref2_room_type',
    ];
    const firstRow = rows[0];
    const missingCols = requiredCols.filter(c => !(c in firstRow));
    if (missingCols.length > 0) {
        return {
            valid: false,
            errors: [`Missing required columns: ${missingCols.join(', ')}`],
            students: [],
            warnings: [],
        };
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-indexed + header
        const rowErrors = [];

        // --- Required fields ---
        const regNo = (row.reg_no || '').toString().trim();
        const name = (row.name || '').toString().trim();
        const genderRaw = (row.gender || '').toString().trim().toUpperCase();
        const yearRaw = parseInt(row.year);
        const department = (row.department || '').toString().trim();
        const cgpaRaw = parseFloat(row.cgpa);
        const roommate1 = (row.roommate_1 || '').toString().trim();
        const roommate2 = (row.roommate_2 || '').toString().trim();
        const pref1Block = parseInt(row.pref1_block);
        const pref1Type = (row.pref1_room_type || '').toString().trim().toUpperCase();
        const pref2Block = parseInt(row.pref2_block);
        const pref2Type = (row.pref2_room_type || '').toString().trim().toUpperCase();

        if (!regNo) rowErrors.push('Missing reg_no');
        if (!name) rowErrors.push('Missing name');
        if (!department) rowErrors.push('Missing department');

        // Gender
        const gender = genderRaw === 'M' ? 'MALE' : genderRaw === 'F' ? 'FEMALE' : null;
        if (!gender) rowErrors.push(`Invalid gender "${row.gender}" — must be M or F`);

        // Year
        if (![2, 3, 4].includes(yearRaw)) rowErrors.push(`Invalid year "${row.year}" — must be 2, 3, or 4`);

        // CGPA
        if (isNaN(cgpaRaw) || cgpaRaw < 0 || cgpaRaw > 10) {
            rowErrors.push(`Invalid CGPA "${row.cgpa}" — must be 0.0 to 10.0`);
        }

        // Pref 1 validation
        if (isNaN(pref1Block)) {
            rowErrors.push('Missing pref1_block');
        } else {
            if (!BLOCK_CONFIGS.find(b => b.number === pref1Block)) {
                rowErrors.push(`Block ${pref1Block} is not an in-scope block`);
            } else {
                if (gender && !isBlockForGender(pref1Block, gender)) {
                    rowErrors.push(`Block ${pref1Block} does not match gender ${genderRaw}`);
                }
                if (!isValidRoomTypeForBlock(pref1Block, pref1Type)) {
                    rowErrors.push(`Room type ${pref1Type} not available in Block ${pref1Block}`);
                }
            }
        }

        // Pref 2 validation
        if (isNaN(pref2Block)) {
            rowErrors.push('Missing pref2_block');
        } else {
            if (!BLOCK_CONFIGS.find(b => b.number === pref2Block)) {
                rowErrors.push(`Block ${pref2Block} is not an in-scope block`);
            } else {
                if (gender && !isBlockForGender(pref2Block, gender)) {
                    rowErrors.push(`Block ${pref2Block} does not match gender ${genderRaw}`);
                }
                if (!isValidRoomTypeForBlock(pref2Block, pref2Type)) {
                    rowErrors.push(`Room type ${pref2Type} not available in Block ${pref2Block}`);
                }
            }
        }

        // Duplicate reg_no
        if (regNo && regNos.has(regNo)) {
            rowErrors.push(`Duplicate reg_no: ${regNo}`);
        }
        regNos.add(regNo);

        if (rowErrors.length > 0) {
            errors.push(`Row ${rowNum} (${regNo || 'unknown'}): ${rowErrors.join('; ')}`);
        }

        students.push({
            regNo,
            name,
            gender,
            year: yearRaw,
            department,
            cgpa: cgpaRaw,
            roommate1: roommate1 || null,
            roommate2: roommate2 || null,
            pref1Block,
            pref1RoomType: pref1Type,
            pref2Block,
            pref2RoomType: pref2Type,
        });
    }

    // --- Cross-row validations ---

    // Roommate existence check
    for (let i = 0; i < students.length; i++) {
        const s = students[i];
        const rowNum = i + 2;
        if (s.roommate1 && !regNos.has(s.roommate1)) {
            errors.push(`Row ${rowNum} (${s.regNo}): roommate_1 "${s.roommate1}" not found in CSV`);
        }
        if (s.roommate2 && !regNos.has(s.roommate2)) {
            errors.push(`Row ${rowNum} (${s.regNo}): roommate_2 "${s.roommate2}" not found in CSV`);
        }
    }

    // Form groups and validate group size vs room capacity
    const { groups, groupErrors } = formGroups(students);
    errors.push(...groupErrors);

    // Group size vs room capacity check
    for (const group of groups) {
        const leader = group.members[0];
        const p1Cap = getRoomCapacity(leader.pref1RoomType);
        const p2Cap = getRoomCapacity(leader.pref2RoomType);

        if (p1Cap !== null && group.members.length > p1Cap) {
            errors.push(`Group [${group.members.map(m => m.regNo).join(', ')}]: group size ${group.members.length} exceeds Pref 1 room capacity ${p1Cap} (${leader.pref1RoomType})`);
        }
        if (p2Cap !== null && group.members.length > p2Cap) {
            errors.push(`Group [${group.members.map(m => m.regNo).join(', ')}]: group size ${group.members.length} exceeds Pref 2 room capacity ${p2Cap} (${leader.pref2RoomType})`);
        }

        // Gender consistency in group
        const genders = new Set(group.members.map(m => m.gender));
        if (genders.size > 1) {
            errors.push(`Group [${group.members.map(m => m.regNo).join(', ')}]: mixed genders in roommate group`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        students,
        groups,
    };
}

/**
 * Form groups from student list based on roommate references.
 * Uses union-find to handle transitive roommate links.
 */
export function formGroups(students) {
    const errors = [];
    const regMap = new Map();
    students.forEach(s => regMap.set(s.regNo, s));

    // Union-Find
    const parent = new Map();
    function find(x) {
        if (!parent.has(x)) parent.set(x, x);
        if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
        return parent.get(x);
    }
    function union(a, b) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    }

    // Build unions
    for (const s of students) {
        find(s.regNo);
        if (s.roommate1) union(s.regNo, s.roommate1);
        if (s.roommate2) union(s.regNo, s.roommate2);
    }

    // Collect groups
    const groupMap = new Map();
    for (const s of students) {
        const root = find(s.regNo);
        if (!groupMap.has(root)) groupMap.set(root, []);
        groupMap.get(root).push(s);
    }

    const groups = [];
    for (const [root, members] of groupMap) {
        if (members.length > 3) {
            errors.push(`Group [${members.map(m => m.regNo).join(', ')}]: group size ${members.length} exceeds maximum of 3`);
            continue;
        }

        const avgCgpa = members.reduce((sum, m) => sum + m.cgpa, 0) / members.length;

        groups.push({
            members,
            avgCgpa: Math.round(avgCgpa * 100) / 100,
            size: members.length,
        });
    }

    return { groups, groupErrors: errors };
}
