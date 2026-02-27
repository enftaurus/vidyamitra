import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api, apiError } from '../api';
import { setRoundStatus } from '../roundStatus';
import { fetchInterviewFlowStatus, getNextAllowedRound, ROUND_ROUTES } from '../interviewFlow';

const languageTemplates = {
  python: '# Write your Python solution here\n',
  javascript: '// Write your JavaScript solution here\n',
  typescript: '// Write your TypeScript solution here\n',
  java: '// Write your Java solution here\n',
  cpp: '// Write your C++ solution here\n',
};

const indentUnitByLanguage = {
  python: '    ',
  javascript: '  ',
  typescript: '  ',
  java: '  ',
  cpp: '  ',
};

const keywordSuggestionsByLanguage = {
  python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'return', 'import', 'from', 'with', 'lambda', 'pass', 'break', 'continue', 'print', 'len', 'range', 'enumerate', 'append', 'split', 'strip'],
  javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'async', 'await', 'map', 'filter', 'reduce', 'console.log', 'try', 'catch', 'switch'],
  typescript: ['function', 'const', 'let', 'if', 'else', 'for', 'while', 'return', 'class', 'interface', 'type', 'import', 'export', 'async', 'await', 'map', 'filter', 'reduce', 'Promise', 'Record'],
  java: ['public', 'private', 'class', 'static', 'void', 'int', 'String', 'if', 'else', 'for', 'while', 'return', 'new', 'import', 'List', 'Map', 'HashMap', 'ArrayList', 'try', 'catch'],
  cpp: ['int', 'long', 'double', 'string', 'vector', 'map', 'unordered_map', 'if', 'else', 'for', 'while', 'return', 'auto', 'const', 'include', 'using', 'namespace', 'cout', 'cin', 'push_back'],
};

const openingChars = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
};

const monacoLanguageMap = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
};

export default function CodingRoundPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(languageTemplates.python);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [blockedRoute, setBlockedRoute] = useState('');
  const [editorMode, setEditorMode] = useState('monaco');
  const [uiTheme, setUiTheme] = useState('dark');
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [wordRange, setWordRange] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [showSubmitPrompt, setShowSubmitPrompt] = useState(false);
  const [showViolationPrompt, setShowViolationPrompt] = useState(false);
  const editorRef = useRef(null);
  const tabSwitchCountRef = useRef(0);
  const handlingViolationRef = useRef(false);
  const lastViolationAtRef = useRef(0);

  useEffect(() => {
    const readTheme = () => {
      const current = document.documentElement.getAttribute('data-theme');
      setUiTheme(current === 'light' ? 'light' : 'dark');
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const requestFullscreen = async () => {
      if (document.fullscreenElement) return;
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // User gesture may be required.
      }
    };

    requestFullscreen();
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = (event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'c' || key === 'v')) {
        event.preventDefault();
        setError('Copy/paste is disabled during interview rounds.');
      }
    };

    const blockClipboard = (event) => {
      event.preventDefault();
      setError('Copy/paste is disabled during interview rounds.');
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', blockClipboard, true);
    document.addEventListener('paste', blockClipboard, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', blockClipboard, true);
      document.removeEventListener('paste', blockClipboard, true);
    };
  }, []);

  const timeTaken = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  }, [startedAt, submitting]);

  const fetchQuestion = async () => {
    setLoadingQuestion(true);
    setError('');
    try {
      const { data } = await api.get('/coding_round/get_question');
      localStorage.removeItem('interview_cycle_closed');
      setQuestion(data.question || null);
      setStartedAt(Date.now());
      setResult(null);
      setHasSubmitted(false);
      setRoundStatus('coding', 'In Progress');
    } catch (err) {
      setError(apiError(err, 'Unable to load coding question'));
    } finally {
      setLoadingQuestion(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const status = await fetchInterviewFlowStatus();
        const next = getNextAllowedRound(status);
        if (next !== 'coding') {
          setBlockedRoute(ROUND_ROUTES[next] || '/interview');
          return;
        }
        fetchQuestion();
      } catch (err) {
        setError(apiError(err, 'Unable to verify round access'));
      }
    };

    init();
  }, []);

  useEffect(() => {
    const handleViolation = async () => {
      if (!isFullscreen || !question || hasSubmitted || submitting) return;
      const now = Date.now();
      if (now - lastViolationAtRef.current < 800) return;
      lastViolationAtRef.current = now;

      tabSwitchCountRef.current += 1;

      if (tabSwitchCountRef.current === 1) {
        setShowViolationPrompt(true);
        return;
      }

      if (handlingViolationRef.current) return;
      handlingViolationRef.current = true;

      await submitCode(true);
      setError('Second violation detected. Your current code was auto-submitted. Redirecting to next round...');
      navigate('/interview/technical');
    };

    const onVisibility = () => {
      if (document.hidden) {
        handleViolation();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [code, language, timeTaken, hasSubmitted, navigate, isFullscreen, question, submitting]);

  const enterFullscreen = async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError('Please allow fullscreen mode to continue this interview round.');
    }
  };

  if (blockedRoute) {
    return (
      <section className="panel">
        <h2>Coding Round</h2>
        <div className="hint">Coding round is already completed. Continue with the next unlocked round.</div>
        <Link className="btn" to={blockedRoute}>Go to next allowed round</Link>
      </section>
    );
  }

  if (!isFullscreen) {
    return (
      <section className="panel">
        <h2>Coding Round</h2>
        <div className="hint">Coding round runs in fullscreen mode. Please enter fullscreen to continue.</div>
        <button className="btn" onClick={enterFullscreen}>Enter Fullscreen</button>
        {error && <div className="error-box">{error}</div>}
      </section>
    );
  }

  const onLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    if (editorMode === 'fallback') {
      setSuggestions([]);
      setWordRange(null);
    }
    if (!code.trim()) {
      setCode(languageTemplates[nextLanguage]);
    }
  };

  const applyCodeUpdate = (nextCode, nextStart, nextEnd = nextStart) => {
    setCode(nextCode);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(nextStart, nextEnd);
    });
  };

  const getCurrentWordRange = (value, cursor) => {
    const before = value.slice(0, cursor);
    const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    if (!match) return null;
    const start = cursor - match[0].length;
    return { start, end: cursor, prefix: match[0] };
  };

  const updateSuggestions = (nextCode, cursor) => {
    const range = getCurrentWordRange(nextCode, cursor);
    if (!range || !range.prefix) {
      setSuggestions([]);
      setWordRange(null);
      setActiveSuggestion(0);
      return;
    }

    const words = keywordSuggestionsByLanguage[language] || [];
    const prefix = range.prefix.toLowerCase();
    const matches = words.filter((word) => word.toLowerCase().startsWith(prefix) && word.toLowerCase() !== prefix).slice(0, 7);

    setWordRange(range);
    setSuggestions(matches);
    setActiveSuggestion(0);
  };

  const acceptSuggestion = (picked) => {
    if (!wordRange || !picked) return;
    const before = code.slice(0, wordRange.start);
    const after = code.slice(wordRange.end);
    const nextCode = `${before}${picked}${after}`;
    const cursor = wordRange.start + picked.length;
    setSuggestions([]);
    setWordRange(null);
    applyCodeUpdate(nextCode, cursor);
  };

  const handleEditorChange = (event) => {
    const nextCode = event.target.value;
    const cursor = event.target.selectionStart;
    setCode(nextCode);
    updateSuggestions(nextCode, cursor);
  };

  const handleEditorKeyDown = (event) => {
    const textarea = event.currentTarget;
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const indentUnit = indentUnitByLanguage[language] || '  ';

    if ((event.key === 'Tab' || event.key === 'Enter') && suggestions.length > 0 && wordRange) {
      event.preventDefault();
      acceptSuggestion(suggestions[activeSuggestion] || suggestions[0]);
      return;
    }

    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActiveSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === 'Escape' && suggestions.length > 0) {
      event.preventDefault();
      setSuggestions([]);
      setWordRange(null);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();

      if (start !== end) {
        const selected = value.slice(start, end);
        const lines = selected.split('\n');
        const updatedLines = event.shiftKey
          ? lines.map((line) => (line.startsWith(indentUnit) ? line.slice(indentUnit.length) : line.replace(/^\s{1,2}/, '')))
          : lines.map((line) => `${indentUnit}${line}`);
        const replacement = updatedLines.join('\n');
        const nextCode = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

        const newSelectionStart = start;
        const deltaPerLine = event.shiftKey ? -indentUnit.length : indentUnit.length;
        const adjustedDelta = event.shiftKey
          ? lines.reduce((count, line) => count + (line.startsWith(indentUnit) ? indentUnit.length : Math.min(2, (line.match(/^\s+/)?.[0]?.length || 0))), 0)
          : lines.length * indentUnit.length;
        const newSelectionEnd = Math.max(newSelectionStart, end + (event.shiftKey ? -adjustedDelta : adjustedDelta));

        applyCodeUpdate(nextCode, newSelectionStart, newSelectionEnd);
        return;
      }

      const nextCode = `${value.slice(0, start)}${indentUnit}${value.slice(end)}`;
      applyCodeUpdate(nextCode, start + indentUnit.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const beforeCursor = value.slice(0, start);
      const currentLineStart = beforeCursor.lastIndexOf('\n') + 1;
      const currentLine = beforeCursor.slice(currentLineStart);
      const baseIndent = currentLine.match(/^\s*/)?.[0] || '';
      const shouldIndentMore = language === 'python'
        ? currentLine.trim().endsWith(':')
        : /\{\s*$/.test(currentLine);
      const nextIndent = shouldIndentMore ? `${baseIndent}${indentUnit}` : baseIndent;

      const nextCode = `${value.slice(0, start)}\n${nextIndent}${value.slice(end)}`;
      applyCodeUpdate(nextCode, start + 1 + nextIndent.length);
      return;
    }

    const closing = openingChars[event.key];
    if (closing) {
      event.preventDefault();
      const selectedText = value.slice(start, end);
      const wrap = selectedText ? `${event.key}${selectedText}${closing}` : `${event.key}${closing}`;
      const cursor = selectedText ? start + wrap.length : start + 1;
      const nextCode = `${value.slice(0, start)}${wrap}${value.slice(end)}`;
      applyCodeUpdate(nextCode, cursor);
      return;
    }
  };

  const submitCode = async (isAuto = false) => {
    if (hasSubmitted) return;

    if (!isAuto && !code.trim()) {
      setError('Please write code before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data } = await api.post('/coding_round/submit_solution', {
        code: code.trim() ? code : '# Auto-submitted due to tab switching violation',
        language,
        time_taken: timeTaken,
      });
      const analysis = data.analysis || null;
      setResult(analysis);
      setHasSubmitted(true);
      setRoundStatus('coding', 'Completed');
      setShowSubmitPrompt(false);
    } catch (err) {
      setError(apiError(err, 'Unable to evaluate solution'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async () => {
    if (hasSubmitted) {
      setError('You already used your one submission attempt for this question. Load a new question to try again.');
      return;
    }
    setShowSubmitPrompt(true);
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

      {showViolationPrompt && (
        <div className="error-box">
          <strong>Warning:</strong> Tab switching is not allowed during coding round. Next violation will auto-submit your code.
          <div style={{ marginTop: '0.6rem' }}>
            <button className="btn ghost" onClick={() => setShowViolationPrompt(false)}>
              I Understand
            </button>
          </div>
        </div>
      )}

      {showSubmitPrompt && !hasSubmitted && (
        <div className="hint">
          <strong>Final Submission Confirmation</strong>
          <p style={{ margin: '0.45rem 0' }}>
            This submission is final for this question and cannot be changed. Do you want to submit now?
          </p>
          <div style={{ display: 'flex', gap: '0.55rem' }}>
            <button className="btn ghost" onClick={() => setShowSubmitPrompt(false)}>
              Review Again
            </button>
            <button className="btn" onClick={() => submitCode(false)} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Confirm Submit'}
            </button>
          </div>
        </div>
      )}

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
                  disabled={hasSubmitted}
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </label>
              <button className="btn" onClick={onSubmit} disabled={submitting}>
                {submitting ? 'Evaluating...' : hasSubmitted ? 'Submitted' : 'Submit Code'}
              </button>
            </div>

            <div className="editor-toolbar">
              <span className="muted">Editor Mode: <strong>{editorMode === 'monaco' ? 'Monaco' : 'Fallback'}</strong></span>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const nextMode = editorMode === 'monaco' ? 'fallback' : 'monaco';
                  setEditorMode(nextMode);
                  if (nextMode === 'monaco') {
                    setSuggestions([]);
                    setWordRange(null);
                  }
                }}
              >
                {editorMode === 'monaco' ? 'Use Fallback Editor' : 'Use Monaco Editor'}
              </button>
            </div>

            {!hasSubmitted ? (
              <div className="hint">You have only one final submission for this question. Submission is final, so review carefully before clicking submit.</div>
            ) : (
              <div className="success-box">Submission locked for this question. Load a new question if you want another attempt.</div>
            )}

            {editorMode === 'monaco' ? (
              <div className="monaco-editor-shell">
                <Editor
                  height="440px"
                  language={monacoLanguageMap[language] || 'plaintext'}
                  value={code}
                  theme={uiTheme === 'light' ? 'vs' : 'vs-dark'}
                  onChange={(value) => setCode(value || '')}
                  options={{
                    readOnly: hasSubmitted,
                    minimap: { enabled: false },
                    fontSize: 14,
                    tabSize: language === 'python' ? 4 : 2,
                    insertSpaces: true,
                    wordWrap: 'on',
                    smoothScrolling: true,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: true,
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                  loading={<div className="hint">Loading Monaco editor...</div>}
                />
              </div>
            ) : (
              <>
                <textarea
                  ref={editorRef}
                  className="code-editor"
                  value={code}
                  onChange={handleEditorChange}
                  onKeyDown={handleEditorKeyDown}
                  spellCheck={false}
                  placeholder="Write your solution here"
                  disabled={hasSubmitted}
                />

                {suggestions.length > 0 && (
                  <div className="editor-suggestions">
                    {suggestions.map((item, index) => (
                      <button
                        key={`${item}-${index}`}
                        type="button"
                        className={`editor-suggestion-item ${index === activeSuggestion ? 'active' : ''}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          acceptSuggestion(item);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}

                <p className="muted">Tips: <strong>Tab</strong> indent, <strong>Shift+Tab</strong> outdent, <strong>Enter</strong> keeps indentation, <strong>↑/↓ + Enter</strong> accepts suggestions.</p>
              </>
            )}
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
          <div style={{ marginTop: '0.8rem' }}>
            <Link className="btn" to="/interview/technical">
              Proceed to Next Round
            </Link>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
