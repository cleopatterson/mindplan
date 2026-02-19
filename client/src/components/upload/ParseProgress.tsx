import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Time constant for exponential decay — controls how fast progress decelerates.
// At 15s ≈ 60%, at 30s ≈ 82%, at 60s ≈ 93%, at 90s ≈ 94.8% — never stalls.
const TAU = 15000;

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
  const theme = useTheme();
  const isDark = theme === 'dark';
  const [progress, setProgress] = useState(0);
  const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * quips.length));
  const startTime = useRef(Date.now());

  // Asymptotic progress — always creeping, never stalling
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      // Exponential decay: approaches 95% but never arrives
      const pct = 95 * (1 - Math.exp(-elapsed / TAU));
      setProgress(pct);
    }, 200);
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
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}
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
          <span className={`text-sm font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Witty saying only */}
      <p
        key={quipIndex}
        className={`text-sm animate-[fadeIn_0.4s_ease-out] ${isDark ? 'text-white/40' : 'text-gray-500'}`}
      >
        {quips[quipIndex]}
      </p>
    </div>
  );
}
