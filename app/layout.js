import './globals.css';

export const metadata = {
    title: 'MIT Hostel Allotment System',
    description: 'Hostel room allotment management system for Manipal Institute of Technology',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
