import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
    const sessions = await prisma.allotmentSession.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { students: true, allotments: true } },
        },
    });

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1>Session History</h1>
                    <p>All past allotment sessions and their results</p>
                </div>
                <Link href="/admin/upload" className="btn btn-primary">
                    ＋ New Session
                </Link>
            </div>

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
                                <th>ID</th>
                                <th>Session Name</th>
                                <th>Status</th>
                                <th>Students</th>
                                <th>Allotments</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session) => (
                                <tr key={session.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>#{session.id}</td>
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
                                    <td>{new Date(session.createdAt).toLocaleString()}</td>
                                    <td style={{ display: 'flex', gap: '8px' }}>
                                        {session.status !== 'DRAFT' && (
                                            <Link href={`/admin/results/${session.id}`} className="btn btn-outline btn-sm">
                                                📊 Results
                                            </Link>
                                        )}
                                        {session.status === 'DRAFT' && (
                                            <Link href="/admin/allotment" className="btn btn-primary btn-sm">
                                                ⚡ Run
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
    );
}
