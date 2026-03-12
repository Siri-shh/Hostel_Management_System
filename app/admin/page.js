import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    const [blocks, rooms, sessions] = await Promise.all([
        prisma.block.count(),
        prisma.room.count(),
        prisma.allotmentSession.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                _count: { select: { students: true, allotments: true } },
            },
        }),
    ]);

    // Calculate total bed capacity
    const roomsByType = await prisma.room.groupBy({
        by: ['roomTypeId'],
        _count: true,
    });
    const roomTypes = await prisma.roomType.findMany();
    const rtMap = Object.fromEntries(roomTypes.map(rt => [rt.id, rt]));
    const totalBeds = roomsByType.reduce((sum, r) => sum + r._count * (rtMap[r.roomTypeId]?.capacity || 0), 0);

    const latestSession = sessions[0];

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Overview of the MIT Hostel Allotment System</p>
                </div>
                <Link href="/admin/upload" className="btn btn-primary btn-lg">
                    📁 New Allotment
                </Link>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon purple">🏢</div>
                    <div className="stat-info">
                        <h3>{blocks}</h3>
                        <p>Active Blocks</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon cyan">🚪</div>
                    <div className="stat-info">
                        <h3>{rooms.toLocaleString()}</h3>
                        <p>Total Rooms</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">🛏️</div>
                    <div className="stat-info">
                        <h3>{totalBeds.toLocaleString()}</h3>
                        <p>Total Bed Capacity</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow">📋</div>
                    <div className="stat-info">
                        <h3>{sessions.length}</h3>
                        <p>Allotment Sessions</p>
                    </div>
                </div>
            </div>

            <div className="section">
                <h2 className="section-title">📋 Recent Sessions</h2>
                {sessions.length === 0 ? (
                    <div className="empty-state">
                        <h3>No sessions yet</h3>
                        <p>Upload a CSV to start your first allotment session</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Session</th>
                                    <th>Status</th>
                                    <th>Students</th>
                                    <th>Allotments</th>
                                    <th>Created</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((session) => (
                                    <tr key={session.id}>
                                        <td style={{ fontWeight: 600 }}>{session.name}</td>
                                        <td>
                                            <span className={`badge ${session.status === 'ROUND2_DONE' ? 'badge-success' :
                                                    session.status === 'ROUND1_DONE' ? 'badge-warning' :
                                                        'badge-info'
                                                }`}>
                                                {session.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>{session._count.students}</td>
                                        <td>{session._count.allotments}</td>
                                        <td>{new Date(session.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {session.status !== 'DRAFT' ? (
                                                <Link href={`/admin/results/${session.id}`} className="btn btn-outline btn-sm">
                                                    View Results
                                                </Link>
                                            ) : (
                                                <Link href="/admin/allotment" className="btn btn-primary btn-sm">
                                                    Run Allotment
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="section">
                <h2 className="section-title">⚡ Quick Actions</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href="/admin/blocks" className="btn btn-outline">🏢 View Blocks</Link>
                    <Link href="/admin/upload" className="btn btn-outline">📁 Upload CSV</Link>
                    <Link href="/admin/allotment" className="btn btn-outline">⚡ Run Allotment</Link>
                </div>
            </div>
        </div>
    );
}
