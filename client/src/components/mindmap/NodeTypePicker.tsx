import { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { PickerOption } from '../../utils/nodeChildTypes';

interface NodeTypePickerProps {
  x: number;
  y: number;
  options: PickerOption[];
  onPick: (option: PickerOption) => void;
  onClose: () => void;
}

export function NodeTypePicker({ x, y, options, onPick, onClose }: NodeTypePickerProps) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay listener to avoid immediate close from the mouseup that triggered the picker
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp to viewport — account for longer menus
  const menuHeight = 32 + options.length * 36;
  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - menuHeight - 16);

  return (
    <div
      ref={ref}
      className={`fixed z-50 rounded-lg shadow-xl border p-1.5 min-w-[140px]
        ${isDark ? 'bg-[#1e1e2e] border-white/15' : 'bg-white border-gray-200 shadow-gray-300/50'}`}
      style={{ left, top }}
    >
      <div className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider
        ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
        Add
      </div>
      {options.map((option) => (
        <button
          key={option.label}
          onClick={() => onPick(option)}
          className={`cursor-pointer w-full text-left px-3 py-2 text-sm rounded-md transition-colors
            ${isDark ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
