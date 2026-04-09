import prisma from '../lib/prisma.js';

async function main() {
    console.log("Setting up database extensions (Triggers & Procedures)...");

    // 1. Create the stored procedure
    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION log_allotment_change()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                INSERT INTO allotment_audits ("studentId", "oldStatus", "newStatus", "changedAt")
                VALUES (OLD."studentId", OLD.status::text, NEW.status::text, NOW());
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);
    console.log("✅ Stored Procedure 'log_allotment_change' created or updated.");

    // 2. Drop the trigger if it already exists to allow safe re-runs
    await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trigger_allotment_audit ON allotments;
    `);

    // 3. Create the trigger
    await prisma.$executeRawUnsafe(`
        CREATE TRIGGER trigger_allotment_audit
        AFTER UPDATE ON allotments
        FOR EACH ROW
        EXECUTE FUNCTION log_allotment_change();
    `);
    console.log("✅ Trigger 'trigger_allotment_audit' created on 'allotments' table.");

    console.log("Database extensions configured successfully!");
}

main()
    .catch((e) => {
        console.error("Error setting up extensions:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
