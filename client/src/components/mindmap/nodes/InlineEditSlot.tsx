import { useState, useRef, useEffect } from 'react';
import { useMindMapEdit } from '../MindMapContext';

interface InlineEditSlotProps {
  nodeId: string;
  field: string;
  placeholder: string;
}

export function InlineEditSlot({ nodeId, field, placeholder }: InlineEditSlotProps) {
  const ctx = useMindMapEdit();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    if (draft.trim() && ctx) {
      ctx.onUpdateField(nodeId, field, draft.trim());
    }
    setEditing(false);
    setDraft('');
  };

  const cancel = () => {
    setEditing(false);
    setDraft('');
  };

  // Prevent React Flow from capturing pointer events on the input
  const stopEvents = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  if (editing) {
    return (
      <div className="mt-1" {...stopEvents}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full text-[10px] px-1.5 py-0.5 bg-white/10 border border-white/20 rounded
            text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={cancel}
        />
      </div>
    );
  }

  return (
    <div
      className="mt-1 px-1.5 py-0.5 rounded border border-dashed border-white/15 bg-white/5
        cursor-text hover:border-white/25 hover:bg-white/8 transition-colors"
      {...stopEvents}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <span className="text-[10px] text-white/30 italic">{placeholder}</span>
    </div>
  );
}
