import { Link } from 'react-router-dom';
import DynamicHeadline from '../components/DynamicHeadline';
import MarqueeText from '../components/MarqueeText';

const mockRounds = [
  {
    key: 'coding',
    title: 'Coding Round',
    duration: '30 min',
    route: '/mock/coding',
    description: 'Solve a programming problem with full AI coaching feedback',
    icon: '💻',
    color: '#6366f1',
  },
  {
    key: 'technical',
    title: 'Technical Round',
    duration: '20 min',
    route: '/mock/technical',
    description: 'Core CS, DBMS, Networks, OOPS and domain-specific questions',
    icon: '🧠',
    color: '#0ea5e9',
  },
  {
    key: 'manager',
    title: 'Manager Round',
    duration: '15 min',
    route: '/mock/manager',
    description: 'Project ownership, problem-solving and decision-making',
    icon: '📈',
    color: '#f59e0b',
  },
  {
    key: 'hr',
    title: 'HR Round',
    duration: '10 min',
    route: '/mock/hr',
    description: 'Behavioral, personality and cultural alignment questions',
    icon: '🤝',
    color: '#10b981',
  },
];

export default function MockHubPage() {
  return (
    <section className="panel">
      <div className="panel-header between">
        <div>
          <DynamicHeadline
            prefix="Mock Interview"
            words={['Practice Hub', 'Coaching Studio', 'Prep Arena']}
          />
          <p className="muted">
            Practice any round, any time — no sequence locks, no proctoring.
            Get ultra-detailed AI coaching after every session.
          </p>
          <MarqueeText
            items={[
              'No Locks',
              'Any Round',
              'Detailed AI Feedback',
              'What You Said vs What to Say',
              'Human-Level Analysis',
              'Practice Anytime',
            ]}
          />
        </div>
      </div>

      {/* Full Mock Interview Card */}
      <div className="result-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #6366f1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.8rem' }}>🎯</span>
          <div>
            <h3 style={{ margin: 0 }}>Full Mock Interview</h3>
            <span className="pill">All 4 Rounds • ~75 min</span>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Run through all four rounds back-to-back in sequence: Coding → Technical → Manager → HR.
          No proctoring, no locks. Get detailed coaching analysis after each round.
        </p>
        <Link className="btn" to="/mock/coding?proctored=true" style={{ background: '#6366f1', color: '#fff' }}>
          Start Full Mock Interview
        </Link>
      </div>

      {/* Individual Rounds */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Individual Rounds</h3>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Practice any single round without completing others first.
          Perfect for targeted prep on your weak areas.
        </p>
      </div>

      <div className="hub-grid">
        {mockRounds.map((round, index) => (
          <article
            key={round.key}
            className={`hub-card rich ${index % 2 === 0 ? 'layout-main' : 'layout-alt'}`}
            style={{ borderTop: `3px solid ${round.color}` }}
          >
            <div className="hub-card-head">
              <div className="status-card-icon" aria-hidden>{round.icon}</div>
              <div>
                <h3>{round.title}</h3>
                <span className="pill">{round.duration}</span>
              </div>
              <span className="status-badge" style={{ background: round.color + '22', color: round.color }}>
                Mock
              </span>
            </div>
            <p className="muted">{round.description}</p>
            <p className="status-card-desc">
              No proctoring • No sequence lock • Full AI coaching analysis at the end
            </p>
            <Link className="btn ghost" to={round.route}>
              Practice This Round
            </Link>
          </article>
        ))}
      </div>

      <div className="hint" style={{ marginTop: '1.5rem' }}>
        <strong>💡 Tip:</strong> After completing a mock round, you will get a detailed analysis showing
        exactly what you said, what the ideal answer should have been, and specific steps to improve —
        written like a senior interviewer reviewed your session personally.
      </div>
    </section>
  );
}
