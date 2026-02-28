import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiError } from '../api';
import SpeechControls from './SpeechControls';
import { setRoundStatus } from '../roundStatus';
import { stopAllAudioPlayback } from '../audioControl';

const nextRoundRouteByKey = {
  technical: '/interview/manager',
  manager: '/interview/hr',
  hr: '/interview/coding',
};

const voiceQualityScores = [
  { regex: /neural|natural/i, score: 120 },
  { regex: /microsoft|google|siri|samantha|jenny|aria|guy/i, score: 60 },
  { regex: /premium|enhanced|online/i, score: 40 },
  { regex: /en-us|en_us|en-in|en_in/i, score: 20 },
];

const scoreVoice = (voice, targetLang = 'en-US') => {
  const identity = `${voice.name} ${voice.lang}`;
  let score = 0;

  voiceQualityScores.forEach(({ regex, score: weight }) => {
    if (regex.test(identity)) score += weight;
  });

  const normalizedVoiceLang = (voice.lang || '').toLowerCase();
  const normalizedTargetLang = (targetLang || 'en-US').toLowerCase();
  if (normalizedVoiceLang === normalizedTargetLang) score += 80;
  else if (normalizedVoiceLang.startsWith(normalizedTargetLang.split('-')[0])) score += 35;

  if (voice.default) score += 10;
  return score;
};

const getBestVoice = (voices, targetLang = 'en-US') => {
  if (!voices || voices.length === 0) return null;
  const sorted = [...voices].sort((a, b) => scoreVoice(b, targetLang) - scoreVoice(a, targetLang));
  return sorted[0] || null;
};

const splitIntoSpeechChunks = (text, maxLength = 220) => {
  if (!text) return [];
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  parts.forEach((part) => {
    const next = current ? `${current} ${part}` : part;
    if (next.length <= maxLength) {
      current = next;
      return;
    }

    if (current) chunks.push(current);

    if (part.length <= maxLength) {
      current = part;
    } else {
      for (let i = 0; i < part.length; i += maxLength) {
        chunks.push(part.slice(i, i + maxLength));
      }
      current = '';
    }
  });

  if (current) chunks.push(current);
  return chunks;
};

const speakText = (text, selectedVoice, rate = 1, pitch = 1, language = 'en-US') => {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();

  const chunks = splitIntoSpeechChunks(text);
  chunks.forEach((chunk) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = language;
    if (selectedVoice) utterance.voice = selectedVoice;
    window.speechSynthesis.speak(utterance);
  });
};

export default function InterviewConsole({ title, basePath, roundKey }) {
  const [question, setQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [closingNote, setClosingNote] = useState('');
  const [difficulty, setDifficulty] = useState('keep_difficulty');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoReadQuestion, setAutoReadQuestion] = useState(true);
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState('');
  const [ttsModel, setTtsModel] = useState('premium');
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [sttLanguage, setSttLanguage] = useState('en-US');
  const [speechResetToken, setSpeechResetToken] = useState(0);
  const [questionWords, setQuestionWords] = useState([]);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [isQuestionSpeaking, setIsQuestionSpeaking] = useState(false);
  const boundarySeenRef = useRef(false);
  const revealTimerRef = useRef(null);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (!voiceName && available.length > 0) {
        const preferred = getBestVoice(available, sttLanguage) || available[0];
        setVoiceName(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceName, sttLanguage]);

  useEffect(() => {
    if (!voices.length || !ttsModel) return;
    if (voiceName) return;

    const best = getBestVoice(voices, sttLanguage);
    if (best) setVoiceName(best.name);
  }, [voices, voiceName, ttsModel, sttLanguage]);

  const selectedVoice = useMemo(() => voices.find((v) => v.name === voiceName) || null, [voices, voiceName]);

  const effectiveVoice = useMemo(() => {
    if (ttsModel === 'premium') {
      return getBestVoice(voices, sttLanguage) || selectedVoice;
    }
    return selectedVoice;
  }, [ttsModel, voices, sttLanguage, selectedVoice]);

  const effectiveRate = useMemo(() => {
    if (ttsModel === 'premium') return Math.min(1.05, speechRate);
    return speechRate;
  }, [ttsModel, speechRate]);

  const effectivePitch = useMemo(() => {
    if (ttsModel === 'premium') return Math.max(0.95, speechPitch);
    return speechPitch;
  }, [ttsModel, speechPitch]);

  const canSubmit = useMemo(
    () => isStarted && !isEnded && answer.trim().length > 0 && !loading,
    [isStarted, isEnded, answer, loading]
  );

  const nextRoundRoute = useMemo(() => nextRoundRouteByKey[roundKey] || '/interview', [roundKey]);

  const clearRevealTimer = () => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const resetQuestionDisplay = useCallback((text) => {
    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    setQuestionWords(words);
    setVisibleWordCount(words.length);
    setActiveWordIndex(-1);
    setIsQuestionSpeaking(false);
  }, []);

  const findWordIndexByChar = (starts, charIndex) => {
    let low = 0;
    let high = starts.length - 1;
    let candidate = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (starts[mid] <= charIndex) {
        candidate = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return candidate;
  };

  const speakQuestionWithHighlight = useCallback((text) => {
    if (!text) return;

    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    setQuestionWords(words);
    setVisibleWordCount(0);
    setActiveWordIndex(-1);

    if (!window.speechSynthesis) {
      setVisibleWordCount(words.length);
      return;
    }

    window.speechSynthesis.cancel();
    clearRevealTimer();
    boundarySeenRef.current = false;

    const matches = [...text.matchAll(/\S+/g)];
    const starts = matches.map((match) => match.index || 0);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = effectiveRate;
    utterance.pitch = effectivePitch;
    utterance.lang = sttLanguage;
    if (effectiveVoice) utterance.voice = effectiveVoice;

    utterance.onstart = () => {
      setIsQuestionSpeaking(true);
      setVisibleWordCount(Math.min(1, words.length));
      setActiveWordIndex(0);

      revealTimerRef.current = setInterval(() => {
        if (boundarySeenRef.current) return;
        setVisibleWordCount((prev) => {
          const next = Math.min(words.length, prev + 1);
          setActiveWordIndex(Math.max(0, next - 1));
          if (next >= words.length) clearRevealTimer();
          return next;
        });
      }, Math.max(80, Math.round(210 / Math.max(0.7, effectiveRate))));
    };

    utterance.onboundary = (event) => {
      if (typeof event.charIndex !== 'number') return;
      boundarySeenRef.current = true;
      const idx = findWordIndexByChar(starts, event.charIndex);
      setActiveWordIndex(idx);
      setVisibleWordCount((prev) => Math.max(prev, idx + 1));
    };

    utterance.onend = () => {
      clearRevealTimer();
      setVisibleWordCount(words.length);
      setActiveWordIndex(-1);
      setIsQuestionSpeaking(false);
    };

    utterance.onerror = () => {
      clearRevealTimer();
      setVisibleWordCount(words.length);
      setActiveWordIndex(-1);
      setIsQuestionSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [effectivePitch, effectiveRate, effectiveVoice, sttLanguage]);

  useEffect(() => () => {
    clearRevealTimer();
    stopAllAudioPlayback();
  }, []);

  const onStart = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`${basePath}/start`);
      setIsStarted(true);
      setIsEnded(false);
      setAnalysis(null);
      setClosingNote('');
      setHistory([]);
      const nextQuestion = data.question || '';
      setQuestion(nextQuestion);
      resetQuestionDisplay(nextQuestion);
      setQuestionNumber(data.question_number || 1);
      if (roundKey) setRoundStatus(roundKey, 'In Progress');
      if (autoReadQuestion) speakQuestionWithHighlight(nextQuestion);
    } catch (err) {
      setError(apiError(err, 'Unable to start round'));
    } finally {
      setLoading(false);
    }
  };

  const onTranscript = useCallback((transcript) => {
    setAnswer(transcript);
  }, []);

  const onSubmitAnswer = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const submittedAnswer = answer.trim();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post(`${basePath}/answer`, { answer: submittedAnswer });
      setHistory((prev) => [
        ...prev,
        { question: question || `Question ${questionNumber}`, answer: submittedAnswer },
      ]);
      setAnswer('');

      if (data.should_end) {
        setIsEnded(true);
        setAnalysis(data.analysis || null);
        setClosingNote(data.closing_note || 'Interview completed.');
        if (roundKey === 'hr' && data.flow_reset) {
          localStorage.setItem('interview_cycle_closed', 'true');
        }
        if (roundKey) setRoundStatus(roundKey, 'Completed');
        speakText(data.closing_note || 'Interview completed.', effectiveVoice, effectiveRate, effectivePitch, sttLanguage);
      } else {
        const nextQuestion = data.question || '';
        setQuestion(nextQuestion);
        resetQuestionDisplay(nextQuestion);
        setQuestionNumber(data.question_number || questionNumber + 1);
        setDifficulty(data.difficulty || 'keep_difficulty');
        if (autoReadQuestion) speakQuestionWithHighlight(nextQuestion);
      }
    } catch (err) {
      setError(apiError(err, 'Unable to submit answer'));
    } finally {
      setLoading(false);
      setSpeechResetToken((prev) => prev + 1);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header between">
        <h2>{title}</h2>
        <div className="inline-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoReadQuestion}
              onChange={(e) => setAutoReadQuestion(e.target.checked)}
            />
            Auto read question
          </label>
        </div>
      </div>

      <div className="speech-settings-grid">
        <label>
          TTS Model
          <select className="select" value={ttsModel} onChange={(e) => setTtsModel(e.target.value)}>
            <option value="premium">Premium (Best Voice)</option>
            <option value="standard">Standard (Manual Voice)</option>
          </select>
        </label>
        <label>
          Voice
          <select className="select" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
            {voices.map((voice) => (
              <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          STT Language
          <select className="select" value={sttLanguage} onChange={(e) => setSttLanguage(e.target.value)}>
            <option value="en-US">English (US)</option>
            <option value="en-IN">English (India)</option>
            <option value="hi-IN">Hindi (India)</option>
          </select>
        </label>
        <label>
          TTS Speed
          <input type="range" min="0.8" max="1.3" step="0.1" value={speechRate} onChange={(e) => setSpeechRate(Number(e.target.value))} />
        </label>
        <label>
          TTS Pitch
          <input type="range" min="0.8" max="1.2" step="0.1" value={speechPitch} onChange={(e) => setSpeechPitch(Number(e.target.value))} />
        </label>
      </div>

      {!isStarted ? (
        <button className="btn" onClick={onStart} disabled={loading}>
          {loading ? 'Starting...' : 'Start Round'}
        </button>
      ) : (
        <>
          <div className="question-card">
            <div className="question-meta">
              <span>Question #{questionNumber}</span>
              <span className="pill">{difficulty}</span>
            </div>
            <p className="question-live-text" aria-live="polite">
              {questionWords.map((word, index) => {
                const isVisible = index < visibleWordCount;
                const isActive = isQuestionSpeaking && index === activeWordIndex;
                const isSpoken = isVisible && !isActive;

                return (
                  <span
                    key={`${word}-${index}`}
                    className={`tts-word ${isVisible ? (isActive ? 'active' : 'spoken') : 'upcoming'}`}
                  >
                    {word}
                    {index < questionWords.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </p>
            <button className="btn ghost" onClick={() => speakQuestionWithHighlight(question)}>
              Read Question
            </button>
          </div>

          {!isEnded && (
            <form onSubmit={onSubmitAnswer} className="answer-form">
              <label htmlFor="answer">Your Answer</label>
              <textarea
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                placeholder="Type your answer or use speech input"
              />
              <SpeechControls onTranscript={onTranscript} language={sttLanguage} resetToken={speechResetToken} />
              <button className="btn" type="submit" disabled={!canSubmit}>
                {loading ? 'Submitting...' : 'Submit Answer'}
              </button>
            </form>
          )}

          {isEnded && (
            <div className="result-card">
              <h3>Round Completed</h3>
              <p>{closingNote}</p>
              {analysis && (
                <div className="analysis-grid">
                  <div>
                    <strong>Score:</strong> {analysis.score}
                  </div>
                  <div>
                    <strong>Analysis:</strong> {analysis.analysis}
                  </div>
                  <div>
                    <strong>Tips:</strong> {analysis.tips}
                  </div>
                  <div>
                    <strong>Strengths:</strong> {(analysis.strengths || []).join(', ')}
                  </div>
                  <div>
                    <strong>Weaknesses:</strong> {(analysis.weaknesses || []).join(', ')}
                  </div>
                  <div>
                    <strong>Areas To Focus:</strong>{' '}
                    {(analysis.areas_to_focus_on || []).join(', ')}
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.8rem' }}>
                <Link className="btn" to={nextRoundRoute}>
                  Proceed to Next Round
                </Link>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="history-card">
              <h3>Conversation Log</h3>
              {history.map((item, idx) => (
                <div key={`${item.question}-${idx}`} className="history-item">
                  <p>
                    <strong>Q:</strong> {item.question}
                  </p>
                  <p>
                    <strong>A:</strong> {item.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
