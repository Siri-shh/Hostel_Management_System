export function calculateFees(blockNum, roomTypeName) {
    if (!roomTypeName) return null;
    
    const rt = roomTypeName.toUpperCase();
    const isAC = rt.includes('AC');
    const isSingle = rt.includes('SINGLE') || rt.includes('1 BED');
    const isDouble = rt.includes('DOUBLE') || rt.includes('2 BED');
    const isTriple = rt.includes('TRIPLE') || rt.includes('3 BED');
    const isQuad = rt.includes('QUAD') || rt.includes('4 BED');
    const block = parseInt(blockNum);
    
    let facilities = 0;
    // Base defaults based on AC / Non-AC
    let acAdvance = isAC ? 10000 : 0;
    let deposit = isAC ? 15000 : 7500;
    let messAdvance = 62000; // Constant across all accommodations

    if (isAC) {
        if (isSingle) {
            facilities = 162000;
            acAdvance = 15000; // Special case for Single AC
        } else if (isDouble) {
            // Based on the provided fee chart for Double AC
            if ([7, 9, 16, 17].includes(block)) facilities = 105000;
            else if ([22].includes(block)) facilities = 127000; // Block 22 is premium
            else facilities = 110000; // General double AC
        } else if (isTriple) {
            facilities = 93000;
        } else if (isQuad) {
            facilities = 75000;
        } else {
            facilities = 110000; // Safe Fallback
        }
    } else { 
        // Non-AC
        if (isSingle) {
            if ([11].includes(block)) facilities = 88000;
            else if ([6, 10].includes(block)) facilities = 68000; // Common bath
            else facilities = 133000; // Single attached bath
        } else if (isDouble) {
            if ([8, 13].includes(block)) facilities = 88000;
            else if ([3, 4, 5, 6, 9, 11].includes(block)) facilities = 79000;
            else facilities = 61000; // Double common bath fallback
        } else if (isTriple) {
            if ([11].includes(block)) facilities = 59000;
            else facilities = 58000;
        } else {
            facilities = 52000; // Dorm/Common room fallback
        }
    }

    const total = facilities + acAdvance + deposit + messAdvance;

    return {
        facilitiesFee: facilities,
        acElectricityAdvance: acAdvance,
        hostelDeposit: deposit,
        messAdvance: messAdvance,
        totalAmount: total
    };
}
