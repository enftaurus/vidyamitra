import { Link } from 'react-router-dom';
import { getRoundStatus } from '../roundStatus';

const rounds = [
  { key: 'coding', title: 'Coding Round', duration: '30 min', route: '/interview/coding', description: 'Solve a coding problem in editor' },
  { key: 'technical', title: 'Technical Round', duration: '20 min', route: '/interview/technical', description: 'Core CS + domain interview' },
  { key: 'manager', title: 'Manager Round', duration: '15 min', route: '/interview/manager', description: 'Projects and problem-solving focus' },
  { key: 'hr', title: 'HR Round', duration: '10 min', route: '/interview/hr', description: 'Personality and behavioral assessment' },
];

export default function InterviewHubPage() {
  const status = getRoundStatus();

  return (
    <section className="panel">
      <div className="panel-header between">
        <div>
          <h2>Interview Hub</h2>
          <p className="muted">Complete all rounds for full assessment</p>
        </div>
      </div>

      <div className="hub-grid">
        {rounds.map((round) => {
          const isDone = status[round.key] === 'Completed';
          return (
            <article key={round.key} className="hub-card">
              <div className="between">
                <h3>{round.title}</h3>
                <span className="pill">{round.duration}</span>
              </div>
              <p className="muted">{round.description}</p>
              <p>
                Status: <strong>{status[round.key] || 'Not Started'}</strong>
              </p>
              <Link className="btn ghost" to={round.route}>
                {isDone ? 'Redo Round' : 'Start Round'}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
