import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/resume-upload', label: 'Resume' },
  { to: '/domain-switch', label: 'Domain Switch' },
  { to: '/interview', label: 'Interview Hub' },
  { to: '/interview/coding', label: 'Coding' },
  { to: '/interview/technical', label: 'Technical' },
  { to: '/interview/manager', label: 'Manager' },
  { to: '/interview/hr', label: 'HR' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await api.post('/logout/');
    } catch {
      // no-op
    } finally {
      navigate('/auth');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Vidyamitra Portal</div>
        <nav className="nav-links">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={location.pathname === link.to ? 'active' : ''}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="btn ghost" onClick={onLogout}>
          Logout
        </button>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
