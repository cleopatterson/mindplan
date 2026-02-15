import { useState } from 'react';
import type { DataGap, Entity } from 'shared/types';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface GapsChecklistProps {
  gaps: DataGap[];
  entities: Entity[];
}

export function GapsChecklist({ gaps, entities }: GapsChecklistProps) {
  const [expanded, setExpanded] = useState(true);
  const entityMap = new Map(entities.map((e) => [e.id, e.name]));

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <span className="font-medium text-amber-900">
          Information Needed ({gaps.length} items)
        </span>
        <span className="ml-auto text-amber-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-1.5">
          {gaps.map((gap, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>
                {gap.description}
                {gap.entityId && (
                  <span className="text-amber-600 ml-1">
                    ({entityMap.get(gap.entityId) || gap.entityId})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
