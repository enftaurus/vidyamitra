import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, apiError } from '../api';
import { fetchInterviewFlowStatus, getNextAllowedRound, isRoundLocked, toUiStatus, isInterviewUnlocked, getActiveJob, clearActiveJob } from '../interviewFlow';
import { clearRoundStatus } from '../roundStatus';
import DynamicHeadline from '../components/DynamicHeadline';
import MarqueeText from '../components/MarqueeText';

const rounds = [
  { key: 'coding', title: 'Coding Round', duration: '30 min', route: '/interview/coding', description: 'Solve a coding problem in editor', icon: '💻' },
  { key: 'technical', title: 'Technical Round', duration: '20 min', route: '/interview/technical', description: 'Core CS + domain interview', icon: '🧠' },
  { key: 'manager', title: 'Manager Round', duration: '15 min', route: '/interview/manager', description: 'Projects and problem-solving focus', icon: '📈' },
  { key: 'hr', title: 'HR Round', duration: '10 min', route: '/interview/hr', description: 'Personality and behavioral assessment', icon: '🤝' },
];

export default function InterviewHubPage() {
  const [status, setStatus] = useState({
    coding: 'not_started',
    technical: 'not_started',
    manager: 'not_started',
    hr: 'not_started',
  });
  const [error, setError] = useState('');
  const [cycleClosed, setCycleClosed] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const unlocked = isInterviewUnlocked();

  const loadStatus = async () => {
    try {
      const backendStatus = await fetchInterviewFlowStatus();
      setStatus(backendStatus);
    } catch (err) {
      setError(apiError(err, 'Unable to load interview flow status'));
    }
  };

  useEffect(() => {
    setCycleClosed(localStorage.getItem('interview_cycle_closed') === 'true');
    setActiveJob(getActiveJob());
    loadStatus();
  }, []);

  const onReset = async () => {
    if (!window.confirm('Reset all rounds? This will clear all progress and you will start from the beginning.')) return;
    try {
      await api.post('/interview_flow/reset');
      clearRoundStatus();
      clearActiveJob();
      setActiveJob(null);
      localStorage.removeItem('interview_cycle_closed');
      setCycleClosed(false);
      setError('');
      await loadStatus();
    } catch (err) {
      setError(apiError(err, 'Unable to reset interview flow'));
    }
  };

  const onStartNewCycle = async () => {
    try {
      await api.post('/interview_flow/reset');
      clearRoundStatus();
      clearActiveJob();
      setActiveJob(null);
      localStorage.removeItem('interview_cycle_closed');
      setCycleClosed(false);
      setError('');
      await loadStatus();
    } catch (err) {
      setError(apiError(err, 'Unable to start new cycle'));
    }
  };

  const nextAllowed = getNextAllowedRound(status);
  const completedCount = rounds.filter((round) => status[round.key] === 'completed').length;
  const progressPercent = Math.round((completedCount / rounds.length) * 100);

  return (
    <section className="panel">
      {/* Locked Banner */}
      {!unlocked && (
        <div className="hint" style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
          <h3 style={{ margin: '0 0 0.35rem', color: '#e2e8f0' }}>Interview Locked</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
            Go to the <strong>Jobs</strong> page and click <strong>Quick Apply</strong> on a Vidyamitra job to unlock your interview rounds.
          </p>
          <Link className="btn" to="/jobs">Browse Jobs →</Link>
        </div>
      )}

      {/* Active Job Banner */}
      {unlocked && activeJob && (
        <div style={{
          background: 'linear-gradient(135deg, #6366f115, #818cf815)',
          border: '1px solid #6366f140',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '1.5rem' }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>
              Interviewing for: {activeJob.title || 'Unknown Role'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.15rem' }}>
              {[activeJob.company, activeJob.location].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span style={{
            background: '#22c55e20',
            border: '1px solid #22c55e40',
            borderRadius: '999px',
            padding: '0.2rem 0.7rem',
            fontSize: '0.75rem',
            color: '#86efac',
            fontWeight: 600,
          }}>Active</span>
        </div>
      )}

      <div className="panel-header between">
        <div>
          <DynamicHeadline
            prefix="AI Powered"
            words={['Interview Hub', 'Round Progress', 'Practice Engine']}
          />
          <p className="muted">AI Interview Practice That Prepares You for Real Interviews - Not Just LeetCode.</p>
          <MarqueeText
            items={[
              'Coding Round',
              'Technical Round',
              'Manager Round',
              'HR Round',
              'Proctoring Active',
              'Performance Report',
            ]}
          />
          {cycleClosed && (
            <div className="hint" style={{ marginTop: '0.5rem' }}>
              HR round completed. This interview cycle is closed. Start a new cycle from Coding Round.
            </div>
          )}
          <div className="progress-wrap">
            <div className="progress-meta">
              <span>Progress</span>
              <strong>{completedCount}/{rounds.length} completed ({progressPercent}%)</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          className="btn"
          onClick={onReset}
          style={{ background: '#e74c3c', color: '#fff', fontWeight: 600 }}
        >
          Reset All Rounds
        </button>
      </div>

      <div className="hub-grid">
        {rounds.map((round, index) => {
          const isDone = status[round.key] === 'completed';
          const isLocked = isRoundLocked(status, round.key);
          return (
            <article key={round.key} className={`hub-card rich ${index % 2 === 0 ? 'layout-main' : 'layout-alt'}`}>
              <div className="hub-card-head">
                <div className="status-card-icon" aria-hidden>{round.icon}</div>
                <div>
                  <h3>{round.title}</h3>
                  <span className="pill">{round.duration}</span>
                </div>
                <span className={`status-badge ${status[round.key]}`}>{toUiStatus(status[round.key])}</span>
              </div>
              <p className="muted">{round.description}</p>
              <p className="status-card-desc">Attempt policy, sequence lock, and progression are enforced for this round.</p>
              {cycleClosed ? (
                <button className="btn ghost" disabled>Closed</button>
              ) : isLocked ? (
                <button className="btn ghost" disabled>Locked</button>
              ) : (
                <Link className="btn ghost" to={round.route}>
                  {isDone ? 'Closed' : (nextAllowed === round.key ? 'Start Round' : 'Open Round')}
                </Link>
              )}
            </article>
          );
        })}
      </div>



      {cycleClosed && (
        <div style={{ marginTop: '0.8rem' }}>
          <Link className="btn" to="/interview/coding" onClick={onStartNewCycle}>
            Start New Cycle (Coding Round)
          </Link>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
