import { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { PickerOption } from '../../utils/nodeChildTypes';
import { Target, Users, Handshake, FileCheck, Wallet } from 'lucide-react';

const PICKER_HEADINGS: Record<string, { label: string; Icon: typeof Target }> = {
  client: { label: 'Add to Client', Icon: Wallet },
  entity: { label: 'Add to Entity', Icon: Wallet },
  familyGroup: { label: 'Add Family Member', Icon: Users },
  familyMember: { label: 'Add Grandchild', Icon: Users },
  goalsGroup: { label: 'Add Goal', Icon: Target },
  relationshipsGroup: { label: 'Add Adviser', Icon: Handshake },
  estateClient: { label: 'Add Estate Document', Icon: FileCheck },
};

interface NodeTypePickerProps {
  x: number;
  y: number;
  options: PickerOption[];
  parentNodeType: string;
  onPick: (option: PickerOption) => void;
  onClose: () => void;
}

export function NodeTypePicker({ x, y, options, parentNodeType, onPick, onClose }: NodeTypePickerProps) {
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

  const heading = PICKER_HEADINGS[parentNodeType];
  const HeadingIcon = heading?.Icon;

  return (
    <div
      ref={ref}
      className={`fixed z-50 rounded-lg shadow-xl border p-1.5 min-w-[160px]
        ${isDark ? 'bg-[#1e1e2e] border-white/15' : 'bg-white border-gray-200 shadow-gray-300/50'}`}
      style={{ left, top }}
    >
      <div className={`flex items-center gap-1.5 px-3 py-1.5
        ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
        {HeadingIcon && <HeadingIcon className="w-3 h-3" />}
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {heading?.label ?? 'Add'}
        </span>
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
