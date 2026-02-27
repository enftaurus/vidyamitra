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
  const [faceCount, setFaceCount] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [proctorWarnings, setProctorWarnings] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const handlingViolationRef = useRef(false);
  const lastViolationAtRef = useRef(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const forcingResetRef = useRef(false);
  const proctorViolationCountRef = useRef(0);
  const MAX_PROCTOR_WARNINGS = 5;

  const forceResetAllRounds = async (message) => {
    if (forcingResetRef.current) return;
    forcingResetRef.current = true;

    try {
      await api.post('/interview_flow/reset');
    } catch {
      // Navigate even if reset API call fails.
    } finally {
      setError(message);
      navigate('/interview');
    }
  };

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
        await forceResetAllRounds('Second violation detected. All rounds were reset. Redirecting to Interview Hub...');
      } finally {
        handlingViolationRef.current = false;
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

  useEffect(() => {
    if (loading || locked || fatalError) return undefined;

    let cancelled = false;

    const startFaceMonitoring = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Webcam is not supported in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setCameraReady(true);
        setCameraError('');

        const checkFaces = async () => {
          if (cancelled || forcingResetRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState < 2) return;

          try {
            canvas.width = 320;
            canvas.height = 240;
            const context = canvas.getContext('2d');
            if (!context) return;

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = canvas.toDataURL('image/jpeg', 0.65);

            const { data } = await api.post('/proctoring/face-check', { image });
            const count = Number(data?.face_count ?? 0);
            const status = String(data?.status || 'single_face');
            setFaceCount(count);

            const isInvalid = status === 'no_face' || status === 'multiple_faces' || count !== 1;
            if (!isInvalid) return;

            proctorViolationCountRef.current += 1;
            const warningNo = proctorViolationCountRef.current;
            setProctorWarnings(warningNo);

            if (warningNo >= MAX_PROCTOR_WARNINGS) {
              await forceResetAllRounds('Proctoring rule violated 5 times (no face/multiple faces). Interview terminated and all rounds reset.');
              return;
            }

            const reason = status === 'multiple_faces' ? 'Multiple faces detected' : 'No face detected';
            setError(`Warning ${warningNo}/${MAX_PROCTOR_WARNINGS}: ${reason}. Keep exactly one face visible.`);
          } catch {
            // Ignore transient detector errors.
          }
        };

        await checkFaces();
        faceIntervalRef.current = window.setInterval(checkFaces, 1800);
      } catch {
        setCameraError('Unable to access webcam. Please allow camera permission.');
      }
    };

    startFaceMonitoring();

    return () => {
      cancelled = true;

      if (faceIntervalRef.current) {
        window.clearInterval(faceIntervalRef.current);
        faceIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setCameraReady(false);
      setFaceCount(null);
    };
  }, [loading, locked, fatalError]);

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
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <section className="panel">
        <div className="hint">
          <strong>Webcam Proctoring:</strong>{' '}
          {cameraError
            ? cameraError
            : cameraReady
              ? `Active${typeof faceCount === 'number' ? ` • Faces detected: ${faceCount}` : ''}`
              : 'Starting camera...'}
        </div>
        <div className="hint" style={{ marginTop: '0.4rem' }}>
          <strong>Proctoring warnings:</strong> {proctorWarnings}/{MAX_PROCTOR_WARNINGS} used • {Math.max(0, MAX_PROCTOR_WARNINGS - proctorWarnings)} left
        </div>
      </section>
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
