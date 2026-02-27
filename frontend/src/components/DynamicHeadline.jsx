import { useEffect, useState } from 'react';

export default function DynamicHeadline({
  prefix = 'AI Powered',
  words = [],
  suffix = '',
  interval = 2200,
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!words.length) return undefined;

    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [words, interval]);

  return (
    <h2 className="dynamic-headline">
      <span>{prefix} </span>
      <span className="dynamic-headline-word">{words[index] || ''}</span>
      {suffix ? <span> {suffix}</span> : null}
    </h2>
  );
}
