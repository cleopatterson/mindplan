import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const quips = [
  'Planting the mind map tree...',
  'Harvesting financial data...',
  'Untangling trust structures...',
  'Counting someone else\'s money...',
  'Decoding acronyms (SMSF, anyone?)...',
  'Mapping the family empire...',
  'Finding hidden assets...',
  'Connecting the dots...',
  'Herding entities into nodes...',
  'Calculating net worth (don\'t panic)...',
  'Reading the fine print...',
  'Colour-coding everything...',
  'Making sense of it all...',
  'Nearly there, promise...',
];

export function ParseProgress() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * quips.length));

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => {
        let next: number;
        do {
          next = Math.floor(Math.random() * quips.length);
        } while (next === prev && quips.length > 1);
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      <div className="text-center">
        <p className="text-lg font-medium text-white/80">Analysing your financial plan...</p>
        <p
          key={index}
          className="text-sm text-white/40 mt-2 animate-[fadeIn_0.4s_ease-out]"
        >
          {quips[index]}
        </p>
      </div>
    </div>
  );
}
