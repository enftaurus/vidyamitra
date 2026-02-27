import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiError } from '../api';
import { fetchInterviewFlowStatus, isRoundLocked, toUiStatus } from '../interviewFlow';

export default function DashboardPage() {
  const [roundStatus, setRoundStatus] = useState({
    coding: 'not_started',
    technical: 'not_started',
    manager: 'not_started',
    hr: 'not_started',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const status = await fetchInterviewFlowStatus();
        setRoundStatus(status);
      } catch (err) {
        setError(apiError(err, 'Unable to load interview status'));
      }
    };

    run();
  }, []);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Dashboard</h2>
        <p className="muted">Use dedicated pages for profile, resume, domain switch, and interviews.</p>
      </div>

      <div className="status-grid">
        <div className="status-card">
          <h4>Profile</h4>
          <p>View structured candidate profile details.</p>
          <Link className="btn ghost" to="/profile">Open Profile</Link>
        </div>

        <div className="status-card">
          <h4>Resume Upload</h4>
          <p>Upload resume and view processing output.</p>
          <Link className="btn ghost" to="/resume-upload">Open Resume Upload</Link>
        </div>

        <div className="status-card">
          <h4>Domain Switch</h4>
          <p>Analyze transition to a target domain.</p>
          <Link className="btn ghost" to="/domain-switch">Open Domain Switch</Link>
        </div>
      </div>

      <div className="result-card">
        <h3>Interview Round Status</h3>
        <div className="status-grid">
          <div className="status-card"><h4>Coding</h4><p><strong>{toUiStatus(roundStatus.coding)}</strong></p><Link className="btn ghost" to="/interview/coding">Open</Link></div>
          <div className="status-card"><h4>Technical</h4><p><strong>{toUiStatus(roundStatus.technical)}</strong></p>{isRoundLocked(roundStatus, 'technical') ? <button className="btn ghost" disabled>Locked</button> : <Link className="btn ghost" to="/interview/technical">Open</Link>}</div>
          <div className="status-card"><h4>Manager</h4><p><strong>{toUiStatus(roundStatus.manager)}</strong></p>{isRoundLocked(roundStatus, 'manager') ? <button className="btn ghost" disabled>Locked</button> : <Link className="btn ghost" to="/interview/manager">Open</Link>}</div>
          <div className="status-card"><h4>HR</h4><p><strong>{toUiStatus(roundStatus.hr)}</strong></p>{isRoundLocked(roundStatus, 'hr') ? <button className="btn ghost" disabled>Locked</button> : <Link className="btn ghost" to="/interview/hr">Open</Link>}</div>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
