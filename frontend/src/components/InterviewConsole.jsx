import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api';
import SpeechControls from './SpeechControls';
import { setRoundStatus } from '../roundStatus';

const speakText = (text, selectedVoice, rate = 1, pitch = 1) => {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = 'en-US';
  if (selectedVoice) utterance.voice = selectedVoice;
  window.speechSynthesis.speak(utterance);
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
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [sttLanguage, setSttLanguage] = useState('en-US');
  const [speechResetToken, setSpeechResetToken] = useState(0);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (!voiceName && available.length > 0) {
        const preferred = available.find((v) => /en-US|en_IN|Google|Microsoft/i.test(`${v.lang} ${v.name}`)) || available[0];
        setVoiceName(preferred.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceName]);

  const selectedVoice = useMemo(() => voices.find((v) => v.name === voiceName) || null, [voices, voiceName]);

  const canSubmit = useMemo(
    () => isStarted && !isEnded && answer.trim().length > 0 && !loading,
    [isStarted, isEnded, answer, loading]
  );

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
      setQuestion(data.question || '');
      setQuestionNumber(data.question_number || 1);
      if (roundKey) setRoundStatus(roundKey, 'In Progress');
      if (autoReadQuestion) speakText(data.question || '', selectedVoice, speechRate, speechPitch);
    } catch (err) {
      setError(apiError(err, 'Unable to start round'));
    } finally {
      setLoading(false);
    }
  };

  const onTranscript = useCallback((transcript) => {
    setAnswer((prev) => `${prev} ${transcript}`.trim());
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
        if (roundKey) setRoundStatus(roundKey, 'Completed');
        speakText(data.closing_note || 'Interview completed.', selectedVoice, speechRate, speechPitch);
      } else {
        setQuestion(data.question || '');
        setQuestionNumber(data.question_number || questionNumber + 1);
        setDifficulty(data.difficulty || 'keep_difficulty');
        if (autoReadQuestion) speakText(data.question || '', selectedVoice, speechRate, speechPitch);
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
            <p>{question}</p>
            <button className="btn ghost" onClick={() => speakText(question, selectedVoice, speechRate, speechPitch)}>
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
