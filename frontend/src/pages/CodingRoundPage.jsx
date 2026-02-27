import { useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api';
import { setRoundStatus } from '../roundStatus';

const languageTemplates = {
  python: '# Write your Python solution here\n',
  javascript: '// Write your JavaScript solution here\n',
  typescript: '// Write your TypeScript solution here\n',
  java: '// Write your Java solution here\n',
  cpp: '// Write your C++ solution here\n',
};

export default function CodingRoundPage() {
  const [question, setQuestion] = useState(null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(languageTemplates.python);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(null);

  const timeTaken = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  }, [startedAt, submitting]);

  const fetchQuestion = async () => {
    setLoadingQuestion(true);
    setError('');
    try {
      const { data } = await api.get('/coding_round/get_question');
      setQuestion(data.question || null);
      setStartedAt(Date.now());
      setResult(null);
      setRoundStatus('coding', 'In Progress');
    } catch (err) {
      setError(apiError(err, 'Unable to load coding question'));
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const onLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    if (!code.trim()) {
      setCode(languageTemplates[nextLanguage]);
    }
  };

  const onSubmit = async () => {
    if (!code.trim()) {
      setError('Please write code before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data } = await api.post('/coding_round/submit_solution', {
        code,
        language,
        time_taken: timeTaken,
      });
      const analysis = data.analysis || null;
      setResult(analysis);
      setRoundStatus('coding', 'Completed');
    } catch (err) {
      setError(apiError(err, 'Unable to evaluate solution'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header between">
        <div>
          <h2>Coding Round</h2>
          <p className="muted">Solve the problem and submit for evaluation</p>
        </div>
        <div className="coding-actions">
          <button className="btn ghost" onClick={fetchQuestion} disabled={loadingQuestion}>
            {loadingQuestion ? 'Loading...' : 'New Question'}
          </button>
        </div>
      </div>

      {question && (
        <div className="coding-grid">
          <article className="coding-problem">
            <h3>{question.title}</h3>
            <p><strong>Problem:</strong> {question.problem_statement}</p>
            <p><strong>Input:</strong> {question.input_format}</p>
            <p><strong>Output:</strong> {question.output_format}</p>
            <p><strong>Sample Input:</strong> {question.sample_input}</p>
            <p><strong>Sample Output:</strong> {question.sample_output}</p>
          </article>

          <article className="coding-editor-wrap">
            <div className="between">
              <label>
                Language
                <select
                  className="select"
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </label>
              <button className="btn" onClick={onSubmit} disabled={submitting}>
                {submitting ? 'Evaluating...' : 'Submit Code'}
              </button>
            </div>

            <textarea
              className="code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder="Write your solution here"
            />
          </article>
        </div>
      )}

      {result && (
        <div className="result-card">
          <h3>Evaluation Result</h3>
          <p><strong>Score:</strong> {result.overall_score}/100</p>
          <p><strong>Code Analysis:</strong> {result.code_analysis}</p>
          <p><strong>Improvements:</strong> {result.solution_improvement}</p>
          <p><strong>Tips:</strong> {result.tips_for_user}</p>
          <p><strong>Overall:</strong> {result.overall_analysis}</p>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
