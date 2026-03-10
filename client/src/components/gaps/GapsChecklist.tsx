import { useState } from 'react';
import type { DataGap, Entity } from 'shared/types';
import { Check, X, Crosshair, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

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
  const isDark = useTheme() === 'dark';
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
    <div className="space-y-0">
      {gaps.map((gap, i) => (
        <div key={gap.nodeId ? `${gap.nodeId}-${gap.field}` : `${gap.field}-${gap.entityId ?? 'p'}-${gap.description.slice(0, 40)}`}>
          {editingIndex === i ? (
            <div className={`flex flex-col gap-2 rounded-lg p-3 border ${isDark ? 'bg-white/5 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`text-xs ${isDark ? 'text-amber-300/70' : 'text-amber-700'}`}>{gap.description}</div>
              {isNumericGap(gap) ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={gap.field === 'age' ? 'e.g. 52' : gap.field === 'lastReviewed' ? 'e.g. 2024' : 'e.g. 250,000'}
                    className={`flex-1 text-sm px-2 py-1 border rounded focus:outline-none focus:border-blue-400
                      ${isDark ? 'bg-white/5 border-white/20 text-white/80 placeholder-white/20' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
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
                    className={`cursor-pointer p-1 rounded ${isDark ? 'text-white/30 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className={`text-xs flex-1 italic ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                    Dismiss when resolved
                  </span>
                  <button
                    onClick={() => dismissGap(i)}
                    className="cursor-pointer text-xs text-amber-500 hover:text-amber-400 font-medium"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className={`cursor-pointer p-1 rounded ${isDark ? 'text-white/30 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-100'}`}
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
              className={`group flex items-start gap-3 cursor-pointer rounded-lg px-3 py-3.5 transition-colors
                ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            >
              {/* Exclamation badge */}
              <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5
                ${isDark ? 'bg-amber-500/15' : 'bg-amber-100'}`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  {gap.description}
                </span>
                {gap.entityId && (
                  <span className={`text-xs ml-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                    ({entityMap.get(gap.entityId) || gap.entityId})
                  </span>
                )}
              </div>

              {/* Actions (visible on hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                {gap.nodeId && (
                  <Crosshair className={`w-3.5 h-3.5 ${isDark ? 'text-white/20' : 'text-gray-300'}`} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); dismissGap(i); }}
                  className={`cursor-pointer p-0.5 rounded transition-colors ${isDark ? 'text-white/20 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}
                  title="Dismiss gap"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Separator line between items */}
          {i < gaps.length - 1 && (
            <div className={`mx-3 ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
