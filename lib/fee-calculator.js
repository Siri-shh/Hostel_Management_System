/**
 * calculateFees(blockNum, roomTypeCode)
 *
 * Maps block number + room type code to the exact fee structure
 * from the official MIT Hostel Tariff Chart.
 *
 * Room Type Codes (from seed.js):
 *   SAC  = Single Attached AC
 *   DAC  = Double Attached AC
 *   QAC  = Quadruple Attached AC
 *   SA   = Single Attached Non-AC
 *   DA   = Double Attached Non-AC
 *   SC   = Single Common Bath Non-AC
 *   DC   = Double Common Bath Non-AC
 *
 * Block aliases: Block 23 = Regency Hostel
 *
 * Constants across ALL room types:
 *   Mess Advance = ₹62,000
 *
 * AC rooms: Hostel Deposit = ₹15,000
 * Non-AC rooms: Hostel Deposit = ₹7,500
 */
export function calculateFees(blockNum, roomTypeCode) {
    if (!roomTypeCode) return null;

    const block = parseInt(blockNum);
    const code = String(roomTypeCode).toUpperCase().trim();
    const MESS = 62000;

    // ─────────────────────────────────────────────────────────────────────────
    // AC ROOMS
    // ─────────────────────────────────────────────────────────────────────────

    if (code === 'SAC') {
        // Single Attached Bath AC
        // Blocks: VII, VIII, X, XII, XIII, XIV, XV, XVI, XVII, XVIII, XIX, XX, XXI, REGENCY (23)
        // Facilities: 1,62,000 | AC Advance: 15,000 | Deposit: 15,000 | Mess: 62,000 | Total: 2,54,000
        return fees(162000, 15000, 15000, MESS);
    }

    if (code === 'DAC') {
        // Double Attached Bath AC — fee varies by block
        if ([22].includes(block)) {
            // Block XXII (premium)
            // Facilities: 1,27,000 | AC: 10,000 | Deposit: 15,000 | Mess: 62,000 | Total: 2,14,000
            return fees(127000, 10000, 15000, MESS);
        }
        if ([7, 9, 16, 17].includes(block)) {
            // Blocks VII, IX, XVI, XVII
            // Facilities: 1,05,000 | AC: 10,000 | Deposit: 15,000 | Mess: 62,000 | Total: 1,92,000
            return fees(105000, 10000, 15000, MESS);
        }
        // Default: VIII(8), XII(12), XIII(13), XIV(14), XV(15), REGENCY(23)
        // Facilities: 1,10,000 | AC: 10,000 | Deposit: 15,000 | Mess: 62,000 | Total: 1,97,000
        return fees(110000, 10000, 15000, MESS);
    }

    if (code === 'QAC') {
        // Quadruple Attached Bath AC — Regency (Block 23)
        // Facilities: 75,000 | AC: 10,000 | Deposit: 15,000 | Mess: 62,000 | Total: 1,62,000
        return fees(75000, 10000, 15000, MESS);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NON-AC ROOMS  (AC Advance = 0, Deposit = 7,500)
    // ─────────────────────────────────────────────────────────────────────────

    if (code === 'SA') {
        // Single Attached Bath Non-AC
        // Blocks: I, IX, XIII, XVIII, XIX, XX, XXI
        // Facilities: 1,33,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 2,02,500
        return fees(133000, 0, 7500, MESS);
    }

    if (code === 'DA') {
        // Double Attached Bath Non-AC — fee varies by block
        if ([8, 13].includes(block)) {
            // Blocks VIII, XIII
            // Facilities: 88,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 1,57,500
            return fees(88000, 0, 7500, MESS);
        }
        // Default: III, IV, V, VI, IX, XI (and any other block)
        // Facilities: 79,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 1,48,500
        return fees(79000, 0, 7500, MESS);
    }

    if (code === 'SC') {
        // Single Common Bath Non-AC — fee varies by block
        if ([11].includes(block)) {
            // Block XI
            // Facilities: 88,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 1,57,500
            return fees(88000, 0, 7500, MESS);
        }
        // Default: VI, X
        // Facilities: 68,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 1,37,500
        return fees(68000, 0, 7500, MESS);
    }

    if (code === 'DC') {
        // Double Common Bath Non-AC
        // Blocks: I, II, III, IV, V, VI, IX, X
        // Facilities: 61,000 | AC: - | Deposit: 7,500 | Mess: 62,000 | Total: 1,30,500
        return fees(61000, 0, 7500, MESS);
    }

    // Fallback for any unexpected code
    return null;
}

/** Helper to assemble the fee breakdown object */
function fees(facilitiesFee, acElectricityAdvance, hostelDeposit, messAdvance) {
    return {
        facilitiesFee,
        acElectricityAdvance,
        hostelDeposit,
        messAdvance,
        totalAmount: facilitiesFee + acElectricityAdvance + hostelDeposit + messAdvance,
    };
}
