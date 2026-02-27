import { useEffect, useRef, useState } from 'react';

export default function SpeechControls({ onTranscript, language = 'en-US', resetToken = 0 }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [lastError, setLastError] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += ` ${event.results[i][0].transcript}`;
        } else {
          interim += ` ${event.results[i][0].transcript}`;
        }
      }
      const combined = `${finalTranscriptRef.current} ${interim}`.trim();
      onTranscript(combined);
    };

    recognition.onerror = (event) => {
      setLastError(event.error || 'Speech recognition error');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, language]);

  useEffect(() => {
    finalTranscriptRef.current = '';
    setLastError('');
  }, [resetToken]);

  const start = () => {
    if (!recognitionRef.current) return;
    finalTranscriptRef.current = '';
    setLastError('');
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  if (!isSupported) {
    return <div className="hint">Speech-to-text is not supported in this browser.</div>;
  }

  return (
    <>
      <div className="speech-controls">
        {!isListening ? (
          <button type="button" className="btn" onClick={start}>
            Start Speaking
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={stop}>
            Stop Listening
          </button>
        )}
      </div>
      {lastError && <div className="hint">Speech error: {lastError}</div>}
    </>
  );
}
