import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';

const links = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/resume-upload', label: 'Resume' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/job-market', label: 'Job Market' },
  { to: '/domain-switch', label: 'Domain Switch' },
  { to: '/admin', label: 'Admin' },
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
  const showLogout = location.pathname !== '/auth' && location.pathname !== '/';
  const isLanding = location.pathname === '/';

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
    <div className={`app-shell ${isLanding ? 'landing-mode' : ''}`}>
      {!isLanding && (
      <header className="topbar">
        <Link to="/" className="brand">VidyaMitra</Link>
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
      )}
      <main className={isLanding ? '' : 'content'}>{children}</main>
    </div>
  );
}
