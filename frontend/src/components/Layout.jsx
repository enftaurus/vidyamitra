import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  const [theme, setTheme] = useState('light');
  const showLogout = location.pathname !== '/auth';

  useEffect(() => {
    const savedTheme = localStorage.getItem('vidyamitra-theme');
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const onToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('vidyamitra-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

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
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
        </button>
        {showLogout && (
          <button className="btn ghost" onClick={onLogout}>
            Logout
          </button>
        )}
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
