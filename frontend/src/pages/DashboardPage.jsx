import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiError } from '../api';
import { fetchInterviewFlowStatus, isRoundLocked, toUiStatus } from '../interviewFlow';

export default function DashboardPage() {
  const quickCards = [
    {
      title: 'Profile',
      description: 'View structured candidate profile details and personal data snapshot.',
      cta: 'Open Profile',
      to: '/profile',
      icon: '👤',
      tag: 'Candidate Data',
    },
    {
      title: 'Resume Upload',
      description: 'Upload or build resume and review extracted insights in one place.',
      cta: 'Open Resume Upload',
      to: '/resume-upload',
      icon: '📄',
      tag: 'Resume Center',
    },
    {
      title: 'Domain Switch',
      description: 'Analyze transition paths and identify readiness for target role shifts.',
      cta: 'Open Domain Switch',
      to: '/domain-switch',
      icon: '🔁',
      tag: 'Career Shift',
    },
  ];

  const roundCards = [
    { key: 'coding', title: 'Coding', to: '/interview/coding', icon: '💻' },
    { key: 'technical', title: 'Technical', to: '/interview/technical', icon: '🧠' },
    { key: 'manager', title: 'Manager', to: '/interview/manager', icon: '📈' },
    { key: 'hr', title: 'HR', to: '/interview/hr', icon: '🤝' },
  ];

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
        {quickCards.map((card, index) => (
          <article className={`status-card rich ${index % 2 === 1 ? 'layout-alt' : 'layout-main'}`} key={card.title}>
            <div className="status-card-top">
              <div className="status-card-icon" aria-hidden>{card.icon}</div>
              <span className="status-badge neutral">{card.tag}</span>
            </div>
            <h4>{card.title}</h4>
            <p className="status-card-desc">{card.description}</p>
            <div className="status-card-footer">
              <Link className="btn ghost" to={card.to}>{card.cta}</Link>
            </div>
          </article>
        ))}
      </div>

      <div className="result-card">
        <h3>Interview Round Status</h3>
        <div className="status-grid">
          {roundCards.map((round, index) => {
            const roundState = roundStatus[round.key];
            const isLocked = isRoundLocked(roundStatus, round.key);
            return (
              <article key={round.key} className={`status-card rich ${index % 2 === 0 ? 'layout-main' : 'layout-alt'}`}>
                <div className="status-card-top">
                  <div className="status-card-icon" aria-hidden>{round.icon}</div>
                  <span className={`status-badge ${roundState}`}>{toUiStatus(roundState)}</span>
                </div>
                <h4>{round.title}</h4>
                <p className="status-card-desc">Round progress and availability based on interview flow rules.</p>
                <div className="status-card-footer">
                  {isLocked ? (
                    <button className="btn ghost" disabled>Locked</button>
                  ) : (
                    <Link className="btn ghost" to={round.to}>Open Round</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
