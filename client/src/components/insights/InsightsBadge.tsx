import React from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import type { Insight } from 'shared/types';

interface InsightsBadgeProps {
  insights: Insight[] | null;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}

export const InsightsBadge = React.memo(function InsightsBadge({ insights, loading, active, onClick }: InsightsBadgeProps) {
  if (!loading && !insights) return null;

  const hasCritical = insights?.some((i) => i.severity === 'critical');
  const count = insights?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`insights-badge cursor-pointer flex items-center gap-2 px-3 py-2
        backdrop-blur-md border rounded-lg text-sm font-medium transition-all
        ${active
          ? 'badge-active bg-blue-500/20 border-blue-400/40 text-blue-300'
          : 'bg-blue-500/10 border-blue-500/20 text-blue-400/80 hover:bg-blue-500/20'}
      `}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span className="relative">
          <Lightbulb className="w-4 h-4" />
          {hasCritical && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          )}
        </span>
      )}
      {loading ? 'Analyzing...' : `${count} insight${count !== 1 ? 's' : ''}`}
    </button>
  );
});
