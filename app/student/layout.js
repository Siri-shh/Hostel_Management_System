import './student.css';

export const metadata = {
    title: 'MIT Hostel Portal — Student',
    description: 'MIT Manipal Hostel Allotment Student Portal',
};

export default function StudentLayout({ children }) {
    return (
        <div className="student-app">
            {children}
        </div>
    );
}
