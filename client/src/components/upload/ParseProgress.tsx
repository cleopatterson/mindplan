import { useState, useEffect, useRef } from 'react';

const TOTAL_DURATION = 30000; // estimated 30s total

const quips = [
  'Untangling trust structures...',
  'Counting someone else\'s money...',
  'Decoding acronyms (SMSF, anyone?)...',
  'Mapping the family empire...',
  'Finding hidden assets...',
  'Herding entities into nodes...',
  'Calculating net worth (don\'t panic)...',
  'Reading the fine print...',
  'Making sense of it all...',
];

export function ParseProgress() {
  const [progress, setProgress] = useState(0);
  const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * quips.length));
  const startTime = useRef(Date.now());

  // Progress toward ~95% with ease-out deceleration
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const linear = Math.min(elapsed / TOTAL_DURATION, 1);
      // Ease-out: decelerates as it approaches 95%
      const eased = 1 - Math.pow(1 - linear, 2.5);
      setProgress(Math.min(eased * 95, 95));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Rotate quips
  useEffect(() => {
    const id = setInterval(() => {
      setQuipIndex((prev) => {
        let next: number;
        do {
          next = Math.floor(Math.random() * quips.length);
        } while (next === prev && quips.length > 1);
        return next;
      });
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // SVG circular progress
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6 py-12 px-6 max-w-md w-full">
      {/* Gradient progress spinner */}
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64" fill="none">
          <defs>
            <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="32" cy="32" r={radius}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="4"
            fill="none"
          />
          {/* Progress arc */}
          <circle
            cx="32" cy="32" r={radius}
            stroke="url(#spinner-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        {/* Percentage in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-white/50">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Witty saying only */}
      <p
        key={quipIndex}
        className="text-sm text-white/40 animate-[fadeIn_0.4s_ease-out]"
      >
        {quips[quipIndex]}
      </p>
    </div>
  );
}
