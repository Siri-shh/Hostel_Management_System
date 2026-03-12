import { NextResponse } from 'next/server';
import { validateCSV } from '@/lib/csv-validator';

export async function POST(request) {
    try {
        const { rows } = await request.json();
        if (!rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const result = validateCSV(rows);
        return NextResponse.json({
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
            studentCount: result.students?.length || 0,
            groupCount: result.groups?.length || 0,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
