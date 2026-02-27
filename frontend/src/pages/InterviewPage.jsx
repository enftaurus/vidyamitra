import InterviewConsole from '../components/InterviewConsole';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '../api';
import { fetchInterviewFlowStatus, getNextAllowedRound, isRoundLocked, ROUND_ROUTES } from '../interviewFlow';

export default function InterviewPage({ title, basePath, roundKey }) {
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [nextRoute, setNextRoute] = useState('/interview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [showViolationPrompt, setShowViolationPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const tabSwitchCountRef = useRef(0);
  const handlingViolationRef = useRef(false);
  const lastViolationAtRef = useRef(0);

  useEffect(() => {
    const run = async () => {
      try {
        const status = await fetchInterviewFlowStatus();
        const nextRound = getNextAllowedRound(status);
        setNextRoute(ROUND_ROUTES[nextRound] || '/interview');
        setLocked(isRoundLocked(status, roundKey));
      } catch (err) {
        setFatalError(apiError(err, 'Unable to verify round access'));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [roundKey]);

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

  useEffect(() => {
    const handleViolation = async () => {
      if (!isFullscreen || loading || locked || fatalError) return;
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

      try {
        await api.post('/interview_flow/reset');
      } catch {
        // continue to navigate even if API call fails
      } finally {
        setError('Second violation detected. All rounds were reset. Redirecting to Coding Round...');
        navigate('/interview/coding');
      }
    };

    const onVisibility = () => {
      if (document.hidden) handleViolation();
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [navigate, isFullscreen, loading, locked, fatalError]);

  const enterFullscreen = async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setError('Please allow fullscreen mode to continue this interview round.');
    }
  };

  if (loading) {
    return <section className="panel"><div className="hint">Checking round access...</div></section>;
  }

  if (fatalError) {
    return <section className="panel"><div className="error-box">{fatalError}</div></section>;
  }

  if (locked) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <div className="hint">This round is locked. Complete previous rounds first.</div>
        <Link className="btn" to={nextRoute}>Go to next allowed round</Link>
      </section>
    );
  }

  if (!isFullscreen) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <div className="hint">This round runs in fullscreen mode. Please enter fullscreen to continue.</div>
        <button className="btn" onClick={enterFullscreen}>Enter Fullscreen</button>
        {error && <div className="error-box">{error}</div>}
      </section>
    );
  }

  return (
    <>
      {showViolationPrompt && (
        <section className="panel">
          <div className="error-box">
            <strong>Warning:</strong> Tab switching is not allowed during interview rounds. Next violation will reset all rounds.
            <div style={{ marginTop: '0.6rem' }}>
              <button className="btn ghost" onClick={() => setShowViolationPrompt(false)}>
                I Understand
              </button>
            </div>
          </div>
        </section>
      )}
      <InterviewConsole title={title} basePath={basePath} roundKey={roundKey} />
      {error && <section className="panel"><div className="error-box">{error}</div></section>}
    </>
  );
}
