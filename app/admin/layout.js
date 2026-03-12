'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './admin.css';

const NAV_ITEMS = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/blocks', label: 'Blocks', icon: '🏢' },
    { href: '/admin/upload', label: 'Upload CSV', icon: '📁' },
    { href: '/admin/allotment', label: 'Run Allotment', icon: '⚡' },
    { href: '/admin/history', label: 'History', icon: '📋' },
];

export default function AdminLayout({ children }) {
    const pathname = usePathname();

    return (
        <div className="admin-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="sidebar-logo">🏠</div>
                    <div>
                        <h2>MIT Hostels</h2>
                        <span>Admin Panel</span>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <Link href="/" className="nav-item logout-btn">
                        <span className="nav-icon">🚪</span>
                        Back to Home
                    </Link>
                    <div className="sidebar-footer-text">
                        <span>Manipal Institute of Technology</span>
                        <span className="version">v1.0 MVP</span>
                    </div>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
