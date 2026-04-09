import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/admin/setup-audit-log
// Creates the session_audit_log table and the Postgres trigger on the Neon DB.
// Safe to call multiple times — uses IF NOT EXISTS so it never drops data.
export async function POST() {
    try {
        // 1. Create the audit log table if it doesn't exist
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS session_audit_log (
                id          SERIAL PRIMARY KEY,
                "sessionId" INTEGER NOT NULL,
                old_status  TEXT,
                new_status  TEXT NOT NULL,
                changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // 2. Create the trigger function
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION log_session_status_change()
            RETURNS TRIGGER AS $$
            BEGIN
                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    INSERT INTO session_audit_log ("sessionId", old_status, new_status, changed_at)
                    VALUES (NEW.id, OLD.status::TEXT, NEW.status::TEXT, NOW());
                END IF;
                IF OLD."portalStatus" IS DISTINCT FROM NEW."portalStatus" THEN
                    INSERT INTO session_audit_log ("sessionId", old_status, new_status, changed_at)
                    VALUES (NEW.id, 'portal:' || OLD."portalStatus"::TEXT, 'portal:' || NEW."portalStatus"::TEXT, NOW());
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 3. Drop trigger if already exists (to allow re-setup), then re-create
        await prisma.$executeRawUnsafe(`
            DROP TRIGGER IF EXISTS trg_session_status_change ON allotment_sessions
        `);

        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER trg_session_status_change
            AFTER UPDATE ON allotment_sessions
            FOR EACH ROW
            EXECUTE FUNCTION log_session_status_change()
        `);

        return NextResponse.json({
            success: true,
            message: 'Audit log table and trigger created successfully on Neon DB.'
        });
    } catch (error) {
        console.error('Audit log setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET /api/admin/setup-audit-log — health check: does the table exist?
export async function GET() {
    try {
        const result = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM information_schema.tables
            WHERE table_name = 'session_audit_log'
        `;
        const exists = Number(result[0]?.count) > 0;
        return NextResponse.json({
            tableExists: exists,
            message: exists
                ? 'Audit log table is set up correctly.'
                : 'Audit log table does NOT exist. Call POST /api/admin/setup-audit-log to create it.'
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
