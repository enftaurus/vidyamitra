import { useState, useEffect, useRef } from 'react';
import { api, apiError } from '../api';

const TOTAL_TIME = 10 * 60; // 10 minutes in seconds

export default function SkillQuizPage() {
  const [userId, setUserId] = useState('');
  const [phase, setPhase] = useState('start'); // start | quiz | submitting | result
  const [questions, setQuestions] = useState([]);
  const [answerKey, setAnswerKey] = useState({});
  const [userSkills, setUserSkills] = useState([]);
  const [matchedSkills, setMatchedSkills] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  // Auto-detect user_id from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('user_id') || localStorage.getItem('user_id') || '';
    if (stored) setUserId(stored);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'quiz') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const fetchQuiz = async () => {
    if (!userId) { setError('Please enter your User ID'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/skill-quiz/questions/${userId}`);
      setQuestions(data.questions || []);
      setAnswerKey(data._answer_key || {});
      setUserSkills(data.user_skills || []);
      setMatchedSkills(data.matched_skills || []);
      setAnswers({});
      setCurrent(0);
      setTimeLeft(TOTAL_TIME);
      setPhase('quiz');
    } catch (err) {
      setError(apiError(err, 'Failed to fetch quiz questions'));
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const handleSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('submitting');
    setError('');
    try {
      const payload = {
        user_id: Number(userId),
        questions: questions.map((q) => ({
          ...q,
          user_answer: answers[q.id] || '',
        })),
        answer_key: answerKey,
      };
      const { data } = await api.post('/skill-quiz/evaluate', payload);
      setResult(data);
      setPhase('result');
    } catch (err) {
      setError(apiError(err, 'Failed to evaluate quiz'));
      setPhase('quiz');
    }
  };

  const retakeQuiz = () => {
    setPhase('start');
    setResult(null);
    setQuestions([]);
    setAnswers({});
    setError('');
  };

  // ── Start screen ──
  if (phase === 'start') {
    return (
      <div className="quiz-page">
        <div className="quiz-start-card">
          <div className="quiz-start-icon">🧠</div>
          <h1>Skill Assessment Quiz</h1>
          <p className="quiz-start-desc">
            Test your knowledge with 10 questions tailored to your resume skills.
            You'll have <strong>10 minutes</strong> to complete the quiz. Results
            are analyzed by AI for detailed feedback.
          </p>
          <div className="quiz-start-input-row">
            <input
              type="text"
              placeholder="Your User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="quiz-uid-input"
            />
            <button className="btn primary" onClick={fetchQuiz} disabled={loading}>
              {loading ? 'Loading...' : 'Start Quiz →'}
            </button>
          </div>
          {error && <div className="error-box" style={{ marginTop: '1rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ── Submitting screen ──
  if (phase === 'submitting') {
    return (
      <div className="quiz-page">
        <div className="quiz-start-card">
          <div className="quiz-start-icon pulse-icon">⏳</div>
          <h2>Evaluating your answers...</h2>
          <p className="muted">AI is analyzing your performance. This may take a few seconds.</p>
        </div>
      </div>
    );
  }

  // ── Result screen ──
  if (phase === 'result' && result) {
    const analysis = result.analysis || {};
    const pct = result.percentage || 0;
    const rating = analysis.overall_rating || 'N/A';
    const ratingClass =
      rating === 'Excellent' ? 'excellent' :
      rating === 'Good' ? 'good' :
      rating === 'Average' ? 'average' : 'poor';

    return (
      <div className="quiz-page">
        <div className="quiz-result-card">
          <h1>Quiz Results</h1>

          {/* Score ring */}
          <div className="quiz-score-ring-wrap">
            <svg className="quiz-score-ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" stroke="rgba(150,150,150,0.15)" strokeWidth="10" fill="none" />
              <circle
                cx="60" cy="60" r="52"
                stroke={pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="10" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 327} 327`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="quiz-score-inner">
              <span className="quiz-score-num">{result.score}/{result.total}</span>
              <span className="quiz-score-pct">{pct}%</span>
            </div>
          </div>

          <span className={`quiz-rating-badge ${ratingClass}`}>{rating}</span>
          {analysis.summary && <p className="quiz-summary">{analysis.summary}</p>}

          {/* Skill breakdown */}
          {analysis.skill_breakdown && analysis.skill_breakdown.length > 0 && (
            <div className="quiz-section">
              <h3>Skill Breakdown</h3>
              <div className="quiz-skill-breakdown">
                {analysis.skill_breakdown.map((sb, i) => (
                  <div key={i} className="quiz-sb-row">
                    <span className="quiz-sb-skill">{sb.skill}</span>
                    <span className="quiz-sb-score">{sb.correct}/{sb.total}</span>
                    <span className="quiz-sb-comment">{sb.comment}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {analysis.strengths && analysis.strengths.length > 0 && (
            <div className="quiz-section">
              <h3>💪 Strengths</h3>
              <ul className="quiz-list green">{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}

          {/* Weaknesses */}
          {analysis.weaknesses && analysis.weaknesses.length > 0 && (
            <div className="quiz-section">
              <h3>⚠️ Weaknesses</h3>
              <ul className="quiz-list red">{analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="quiz-section">
              <h3>📚 Recommendations</h3>
              <ul className="quiz-list blue">{analysis.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}

          {/* Answer review */}
          <div className="quiz-section">
            <h3>Answer Review</h3>
            <div className="quiz-review-list">
              {(result.breakdown || []).map((b, i) => (
                <div key={i} className={`quiz-review-item ${b.is_correct ? 'correct' : 'wrong'}`}>
                  <div className="quiz-review-header">
                    <span className="quiz-review-num">Q{b.id}</span>
                    <span className="quiz-review-skill">{b.skill}</span>
                    <span className={`quiz-review-badge ${b.is_correct ? 'correct' : 'wrong'}`}>
                      {b.is_correct ? '✓ Correct' : '✗ Wrong'}
                    </span>
                  </div>
                  <p className="quiz-review-q">{b.question}</p>
                  <div className="quiz-review-answers">
                    {(b.options || []).map((opt, oi) => {
                      const letter = ['A','B','C','D'][oi];
                      const isCorrect = letter === b.correct_answer;
                      const isUser = letter === b.user_answer;
                      return (
                        <div
                          key={oi}
                          className={`quiz-review-opt ${isCorrect ? 'correct' : ''} ${isUser && !isCorrect ? 'wrong' : ''}`}
                        >
                          <span className="quiz-opt-letter">{letter}</span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="btn primary" onClick={retakeQuiz} style={{ marginTop: '2rem' }}>
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // ── Quiz screen ──
  const q = questions[current];
  const answered = Object.keys(answers).length;
  const isLast = current === questions.length - 1;
  const timerDanger = timeLeft < 60;

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        {/* Top bar */}
        <div className="quiz-topbar">
          <div className="quiz-progress-info">
            <span>{answered}/{questions.length} answered</span>
            <span className="quiz-skills-tag">
              Skills: {matchedSkills.length > 0 ? matchedSkills.join(', ') : 'General'}
            </span>
          </div>
          <div className={`quiz-timer ${timerDanger ? 'danger' : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>

        {/* Question */}
        {q && (
          <div className="quiz-question-card">
            <div className="quiz-q-header">
              <span className="quiz-q-num">Question {current + 1} of {questions.length}</span>
              <span className="quiz-q-skill">{q.skill}</span>
            </div>
            <h2 className="quiz-q-text">{q.question}</h2>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const letter = ['A', 'B', 'C', 'D'][oi];
                const selected = answers[q.id] === letter;
                return (
                  <button
                    key={oi}
                    className={`quiz-option ${selected ? 'selected' : ''}`}
                    onClick={() => selectAnswer(q.id, letter)}
                  >
                    <span className="quiz-opt-letter">{letter}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="quiz-nav-row">
          <button
            className="btn ghost"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
          >
            ← Previous
          </button>
          <div className="quiz-dots">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`quiz-dot ${i === current ? 'active' : ''} ${answers[questions[i]?.id] ? 'answered' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
          {isLast ? (
            <button className="btn primary" onClick={handleSubmit}>
              Submit Quiz ✓
            </button>
          ) : (
            <button className="btn primary" onClick={() => setCurrent((c) => c + 1)}>
              Next →
            </button>
          )}
        </div>

        {error && <div className="error-box" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>
    </div>
  );
}
