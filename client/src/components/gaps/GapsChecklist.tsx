import { useState } from 'react';
import type { DataGap, Entity } from 'shared/types';
import { Check, X, Crosshair } from 'lucide-react';

interface GapsChecklistProps {
  gaps: DataGap[];
  entities: Entity[];
  onResolveGap: (gapIndex: number, value?: string, resolvedNodeId?: string) => void;
  onHoverGap: (nodeIds: string[]) => void;
  onFocusGap: (nodeId: string) => void;
}

export function GapsChecklist({ gaps, entities, onResolveGap, onHoverGap, onFocusGap }: GapsChecklistProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const entityMap = new Map(entities.map((e) => [e.id, e.name]));

  const isNumericGap = (gap: DataGap) =>
    ['value', 'amount', 'income', 'age', 'superBalance', 'interestRate', 'lastReviewed'].includes(gap.field);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue('');
  };

  const submitEdit = (index: number) => {
    onResolveGap(index, editValue || undefined, gaps[index]?.nodeId ?? undefined);
    setEditingIndex(null);
    setEditValue('');
  };

  const dismissGap = (index: number) => {
    onResolveGap(index, undefined, gaps[index]?.nodeId ?? undefined);
    setEditingIndex(null);
  };

  return (
    <ul className="space-y-2">
      {gaps.map((gap, i) => (
        <li key={gap.nodeId ? `${gap.nodeId}-${gap.field}` : `${gap.field}-${gap.entityId ?? 'p'}-${gap.description.slice(0, 40)}`} className="group">
          {editingIndex === i ? (
            <div className="flex flex-col gap-2 bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="text-xs text-amber-300/70">{gap.description}</div>
              {isNumericGap(gap) ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={gap.field === 'age' ? 'e.g. 52' : gap.field === 'lastReviewed' ? 'e.g. 2024' : 'e.g. 250,000'}
                    className="flex-1 text-sm px-2 py-1 bg-white/5 border border-white/20 rounded text-white/80 placeholder-white/20 focus:outline-none focus:border-blue-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitEdit(i);
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                  />
                  <button
                    onClick={() => submitEdit(i)}
                    className="cursor-pointer p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="cursor-pointer p-1 text-white/30 hover:bg-white/5 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-white/30 flex-1 italic">
                    Dismiss when resolved
                  </span>
                  <button
                    onClick={() => dismissGap(i)}
                    className="cursor-pointer text-xs text-amber-400 hover:text-amber-300 font-medium"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="cursor-pointer p-1 text-white/30 hover:bg-white/5 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => {
                startEdit(i);
                if (gap.nodeId) onFocusGap(gap.nodeId);
              }}
              onMouseEnter={() => { if (gap.nodeId) onHoverGap([gap.nodeId]); }}
              onMouseLeave={() => onHoverGap([])}
              className="flex items-start gap-2 text-sm text-amber-300/70 cursor-pointer
                hover:bg-amber-500/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400/50 shrink-0" />
              <span className="flex-1">
                {gap.description}
                {gap.entityId && (
                  <span className="text-amber-400/40 ml-1">
                    ({entityMap.get(gap.entityId) || gap.entityId})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                {gap.nodeId && (
                  <Crosshair className="w-3.5 h-3.5 text-amber-400/30" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); dismissGap(i); }}
                  className="cursor-pointer p-0.5 text-white/20 hover:text-red-400 rounded transition-colors"
                  title="Dismiss gap"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
