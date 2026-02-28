import InterviewConsole from '../components/InterviewConsole';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '../api';
import { fetchInterviewFlowStatus, getNextAllowedRound, isRoundLocked, ROUND_ROUTES } from '../interviewFlow';
import { stopAllAudioPlayback } from '../audioControl';

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
  const [detectorEngine, setDetectorEngine] = useState('');
  const [qualityHint, setQualityHint] = useState('');
  const [proctorWarnings, setProctorWarnings] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const handlingViolationRef = useRef(false);
  const lastViolationAtRef = useRef(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceIntervalRef = useRef(null);
  const forcingResetRef = useRef(false);
  const faceCheckInFlightRef = useRef(false);
  const proctorViolationCountRef = useRef(0);
  const multiFaceStreakRef = useRef(0);
  const noFaceStreakRef = useRef(0);
  const MULTI_FACE_STREAK_THRESHOLD = 2;
  const NO_FACE_STREAK_THRESHOLD = 3;
  const MAX_PROCTOR_WARNINGS = 30;

  const forceResetAllRounds = async (message) => {
    if (forcingResetRef.current) return;
    forcingResetRef.current = true;
    stopAllAudioPlayback();

    try {
      await api.post('/interview_flow/reset');
    } catch {
      // Navigate even if reset API call fails.
    } finally {
      stopAllAudioPlayback();
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
          if (cancelled || forcingResetRef.current || faceCheckInFlightRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || video.readyState < 2) return;
          faceCheckInFlightRef.current = true;

          try {
            canvas.width = 480;
            canvas.height = 360;
            const context = canvas.getContext('2d');
            if (!context) return;

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = canvas.toDataURL('image/jpeg', 0.8);

            const { data } = await api.post('/proctoring/face-check', { image });
            const count = Number(data?.face_count ?? 0);
            const status = String(data?.status || 'single_face');
            const engine = String(data?.engine || '');
            const quality = data?.quality || {};
            setFaceCount(count);
            setDetectorEngine(engine);

            const qualityWarnings = [];
            if (quality.low_light) qualityWarnings.push('Low light');
            if (quality.blurry) qualityWarnings.push('Blurry frame');
            setQualityHint(qualityWarnings.join(' • '));

            const hasMultipleFaces = status === 'multiple_faces' || count > 1;
            const hasNoFace = status === 'no_face' || count === 0;

            if (!hasMultipleFaces && !hasNoFace) {
              multiFaceStreakRef.current = 0;
              noFaceStreakRef.current = 0;
              return;
            }

            let reason = '';
            if (hasMultipleFaces) {
              noFaceStreakRef.current = 0;
              multiFaceStreakRef.current += 1;
              if (multiFaceStreakRef.current < MULTI_FACE_STREAK_THRESHOLD) return;
              multiFaceStreakRef.current = 0;
              reason = 'Multiple faces detected';
            } else if (hasNoFace) {
              multiFaceStreakRef.current = 0;
              noFaceStreakRef.current += 1;
              if (noFaceStreakRef.current < NO_FACE_STREAK_THRESHOLD) return;
              noFaceStreakRef.current = 0;
              reason = 'No face detected';
            }

            proctorViolationCountRef.current += 1;
            const warningNo = proctorViolationCountRef.current;
            setProctorWarnings(warningNo);

            if (warningNo >= MAX_PROCTOR_WARNINGS) {
              await forceResetAllRounds(`Proctoring rule violated ${MAX_PROCTOR_WARNINGS} times (no face/multiple faces). Interview terminated and all rounds reset.`);
              return;
            }

            setError(`Warning ${warningNo}/${MAX_PROCTOR_WARNINGS}: ${reason}. Keep exactly one face visible.`);
          } catch {
            // Ignore transient detector errors.
          } finally {
            faceCheckInFlightRef.current = false;
          }
        };

        await checkFaces();
        faceIntervalRef.current = window.setInterval(checkFaces, 1800);
      } catch (cameraInitError) {
        const reason = cameraInitError?.name || cameraInitError?.message || 'unknown error';
        setCameraError(`Unable to access webcam. Please allow camera permission. (${reason})`);
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
      setDetectorEngine('');
      setQualityHint('');
      faceCheckInFlightRef.current = false;
      multiFaceStreakRef.current = 0;
      noFaceStreakRef.current = 0;
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
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'fixed',
          right: '1rem',
          bottom: '1rem',
          width: '220px',
          maxWidth: '32vw',
          borderRadius: '12px',
          border: '1px solid #d6dfef',
          background: '#000',
          boxShadow: '0 10px 26px rgba(25, 34, 54, 0.2)',
          zIndex: 60,
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <section className="panel">
        <div className="hint">
          <strong>Webcam Proctoring:</strong>{' '}
          {cameraError
            ? cameraError
            : cameraReady
              ? `Active${typeof faceCount === 'number' ? ` • Faces detected: ${faceCount}` : ''}${detectorEngine ? ` • Detector: ${detectorEngine}` : ''}`
              : 'Starting camera...'}
        </div>
        {cameraReady && qualityHint && (
          <div className="hint" style={{ marginTop: '0.4rem' }}>
            <strong>Camera Quality:</strong> {qualityHint}
          </div>
        )}
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
