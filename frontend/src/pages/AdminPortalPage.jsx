import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../api';

export default function AdminPortalPage() {
  const [tab, setTab] = useState('jobs');

  return (
    <section className="panel admin-portal">
      <div className="panel-header">
        <h2>🛡️ Admin Portal</h2>
        <p className="muted">Manage jobs and browse user profiles</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'jobs' ? 'active' : ''}`}
          onClick={() => setTab('jobs')}
        >
          📋 Manage Jobs
        </button>
        <button
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          👥 Browse Users
        </button>
      </div>

      {tab === 'jobs' && <ManageJobs />}
      {tab === 'users' && <BrowseUsers />}
    </section>
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

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const hay = [u.name, u.email].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  return (
    <div className="admin-section">
      <div className="admin-search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
        />
        <span className="muted" style={{ marginLeft: '1rem' }}>
          {filtered.length} of {users.length} users
        </span>
      </div>

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
