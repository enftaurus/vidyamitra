import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, apiError } from '../api';

const ADMIN_EMAIL = 'admin@vidyamitra.com';
const ADMIN_PASSWORD = 'admin123';

export default function AdminPortalPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('vm-admin') === '1');
  const [tab, setTab] = useState('jobs');

  const handleLogout = () => {
    sessionStorage.removeItem('vm-admin');
    setAuthed(false);
  };

  if (!authed) {
    return <AdminLogin onSuccess={() => { sessionStorage.setItem('vm-admin', '1'); setAuthed(true); }} />;
  }

  return (
    <div className="admin-shell">
      {/* ── Admin top bar ── */}
      <header className="admin-topbar">
        <Link to="/" className="admin-brand">VidyaMitra<span className="admin-brand-tag">Enterprise</span></Link>
        <div className="admin-topbar-right">
          <span className="admin-user-badge">🛡️ Admin</span>
          <button className="btn ghost small" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="panel admin-portal">
        <div className="panel-header">
          <h2>Admin Portal</h2>
          <p className="muted">Manage jobs and browse user profiles</p>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab('jobs')}>
            📋 Manage Jobs
          </button>
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            👥 Browse Users
          </button>
        </div>

        {tab === 'jobs' && <ManageJobs />}
        {tab === 'users' && <BrowseUsers />}
      </section>
    </div>
  );
}

/* ─── ADMIN LOGIN SCREEN ─── */
function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError('Invalid admin credentials');
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <Link to="/" className="admin-login-brand">VidyaMitra<span className="admin-brand-dot">■</span></Link>
          <h2>Enterprise Login</h2>
          <p className="muted">Sign in to the admin dashboard</p>
        </div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@vidyamitra.com"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn primary full" type="submit">Sign In</button>
        </form>
        <div className="admin-login-hint">
          <span className="muted">Demo credentials: admin@vidyamitra.com / admin123</span>
        </div>
        <Link to="/" className="admin-back-link">← Back to VidyaMitra</Link>
      </div>
    </div>
  );
}

/* ─── MANAGE JOBS TAB ─── */
function ManageJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/jobs/');
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(apiError(err, 'Unable to load jobs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!title.trim() || !company.trim()) {
      setError('Title and company are required');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = { title: title.trim(), company: company.trim() };
      if (location.trim()) payload.location = location.trim();
      if (applyUrl.trim()) payload.apply_url = applyUrl.trim();
      await api.post('/admin/jobs', payload);
      setSuccess('Job posted successfully!');
      setTitle('');
      setCompany('');
      setLocation('');
      setApplyUrl('');
      loadJobs();
    } catch (err) {
      setError(apiError(err, 'Failed to post job'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Delete this job?')) return;
    try {
      await api.delete(`/admin/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setSuccess('Job deleted');
    } catch (err) {
      setError(apiError(err, 'Failed to delete job'));
    }
  };

  return (
    <div className="admin-section">
      <h3>Post a New Job</h3>
      <form className="admin-form" onSubmit={handleAddJob}>
        <div className="admin-form-grid">
          <div className="form-group">
            <label>Job Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AI Engineer" />
          </div>
          <div className="form-group">
            <label>Company *</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hyderabad" />
          </div>
          <div className="form-group">
            <label>Apply URL</label>
            <input type="url" value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? 'Posting...' : '+ Add Job'}
        </button>
      </form>

      {success && <div className="success-box">{success}</div>}
      {error && <div className="error-box">{error}</div>}

      <h3 style={{ marginTop: '2rem' }}>Existing Jobs ({jobs.length})</h3>
      {loading ? (
        <div className="hint">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="hint">No jobs found.</div>
      ) : (
        <div className="admin-jobs-grid">
          {jobs.map((job) => (
            <article key={job.id} className="admin-job-card">
              <div className="admin-job-info">
                <h4>{job.title || 'Untitled'}</h4>
                <p><strong>Company:</strong> {job.company || '-'}</p>
                <p><strong>Location:</strong> {job.location || '-'}</p>
                {job.apply_url && (
                  <a href={job.apply_url} target="_blank" rel="noreferrer" className="admin-job-link">
                    Apply Link ↗
                  </a>
                )}
              </div>
              <button className="btn danger small" onClick={() => handleDeleteJob(job.id)}>
                🗑 Delete
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── BROWSE USERS TAB ─── */
function BrowseUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/admin/users');
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(apiError(err, 'Unable to load users'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* collect all unique skills across users for quick-pick buttons */
  const allSkills = [...new Set(users.flatMap((u) => (u.skills || []).map((s) => s.toLowerCase())))];
  const topSkills = allSkills.slice(0, 20);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const terms = search.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
    const hayName = [u.name, u.email, u.domain].filter(Boolean).join(' ').toLowerCase();
    const haySkills = (u.skills || []).join(' ').toLowerCase();
    const hay = hayName + ' ' + haySkills;
    return terms.every((term) => hay.includes(term));
  });

  const toggleSkill = (skill) => {
    const current = search.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
    if (current.includes(skill.toLowerCase())) {
      setSearch(current.filter((t) => t !== skill.toLowerCase()).join(', '));
    } else {
      setSearch([...current, skill].join(', '));
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, skill, or domain... (comma for AND)"
        />
        <span className="muted" style={{ marginLeft: '1rem', whiteSpace: 'nowrap' }}>
          {filtered.length} of {users.length} users
        </span>
      </div>

      {topSkills.length > 0 && (
        <div className="admin-skill-chips">
          <span className="admin-chip-label">Filter by skill:</span>
          {topSkills.map((skill) => {
            const active = search.toLowerCase().split(',').map((t) => t.trim()).includes(skill);
            return (
              <button
                key={skill}
                className={`admin-skill-chip ${active ? 'active' : ''}`}
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="hint">Loading users...</div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="hint">No users found.</div>
      ) : (
        <div className="admin-users-grid">
          {filtered.map((user) => (
            <article
              key={user.id}
              className="admin-user-card"
              onClick={() => navigate(`/profile?userid=${user.id}`)}
            >
              <div className="admin-user-avatar">
                {(user.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="admin-user-info">
                <h4>{user.name || 'Unknown'}</h4>
                <p className="muted">{user.email || '-'}</p>
                {user.domain && <span className="admin-user-domain">{user.domain}</span>}
                {user.phone && <p className="admin-user-phone">📞 {user.phone}</p>}
                {user.bio && <p className="admin-user-bio">{user.bio.length > 80 ? user.bio.slice(0, 80) + '...' : user.bio}</p>}
                {(user.skills || []).length > 0 && (
                  <div className="admin-user-skills">
                    {user.skills.slice(0, 6).map((skill, i) => (
                      <span key={i} className="admin-user-skill-pill">{skill}</span>
                    ))}
                    {user.skills.length > 6 && (
                      <span className="admin-user-skill-more">+{user.skills.length - 6}</span>
                    )}
                  </div>
                )}
                <span className="admin-user-id">ID: {user.id}</span>
              </div>
              <span className="admin-user-arrow">→</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
