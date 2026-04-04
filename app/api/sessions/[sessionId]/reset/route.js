import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/sessions/[sessionId]/reset
 *
 * What is deleted:
 *   - All Allotment records for this session
 *   - StudentGroups whose ALL members are PORTAL-source students
 *     (these were synced from PortalGroups and will be re-synced on the next run)
 *
 * What is preserved:
 *   - CSV-sourced StudentGroups (created during upload; needed for re-run without re-upload)
 *   - Student records (both CSV and PORTAL)
 *   - PortalGroups and PortalGroupMember records (students keep their groups/preferences)
 *
 * Session status is reset to DRAFT.
 */
export async function DELETE(request, { params }) {
    try {
        const sessionId = parseInt(params.sessionId);
        if (isNaN(sessionId)) {
            return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
        }

        const session = await prisma.allotmentSession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Find StudentGroups that came from portal sync:
        // ALL members of the group are PORTAL-source students.
        const allGroups = await prisma.studentGroup.findMany({
            where: { sessionId },
            include: {
                members: { include: { student: { select: { source: true } } } },
            },
        });

        const portalSyncedGroupIds = allGroups
            .filter(g =>
                g.members.length > 0 &&
                g.members.every(m => m.student.source === 'PORTAL')
            )
            .map(g => g.id);

        // Delete allotments first (FK constraint), then portal-only StudentGroups
        const [deletedAllotments, deletedGroups] = await prisma.$transaction([
            prisma.allotment.deleteMany({ where: { sessionId } }),
            portalSyncedGroupIds.length > 0
                ? prisma.studentGroup.deleteMany({ where: { id: { in: portalSyncedGroupIds } } })
                : prisma.studentGroup.deleteMany({ where: { id: -1 } }), // no-op
        ]);

        await prisma.allotmentSession.update({
            where: { id: sessionId },
            data: { status: 'DRAFT' },
        });

        return NextResponse.json({
            message: `Reset complete. ${deletedAllotments.count} allotment records cleared. ${deletedGroups.count} portal-synced groups removed (CSV groups preserved).`,
            deletedAllotments: deletedAllotments.count,
            deletedPortalGroups: deletedGroups.count,
        });
    } catch (error) {
        console.error('Reset error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
