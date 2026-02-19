import React from 'react';
import { AlertTriangle, AlertCircle, Info, X, MapPin } from 'lucide-react';
import type { Insight } from 'shared/types';

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', pill: 'bg-red-500/15 text-red-400/90 border-red-500/25' },
  warning: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', pill: 'bg-amber-500/15 text-amber-400/90 border-amber-500/25' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', pill: 'bg-blue-500/15 text-blue-400/90 border-blue-500/25' },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  concentration: 'Concentration',
  liquidity: 'Liquidity',
  tax: 'Tax',
  estate: 'Estate',
  debt: 'Debt',
  insurance: 'Insurance',
  structure: 'Structure',
};

interface InsightsPanelProps {
  insights: Insight[];
  onDismiss: (index: number) => void;
  onFocus: (nodeIds: string[]) => void;
}

export const InsightsPanel = React.memo(function InsightsPanel({ insights, onDismiss, onFocus }: InsightsPanelProps) {
  // Sort: critical first, then warning, then info
  const sorted = insights
    .map((insight, originalIndex) => ({ insight, originalIndex }))
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.insight.severity] - order[b.insight.severity];
    });

  return (
    <div className="space-y-3">
      {sorted.map(({ insight, originalIndex }) => {
        const config = SEVERITY_CONFIG[insight.severity];
        const Icon = config.icon;
        const hasNodes = insight.nodeIds && insight.nodeIds.length > 0;
        return (
          <div key={originalIndex} className={`rounded-xl border ${config.border} ${config.bg} p-3.5 group`}>
            <div className="flex items-start gap-2.5">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-white/90">{insight.title}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${config.pill}`}>
                    {CATEGORY_LABELS[insight.category] ?? insight.category}
                  </span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{insight.detail}</p>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-2">
                  {hasNodes && (
                    <button
                      onClick={() => onFocus(insight.nodeIds)}
                      className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                        bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Show on map
                    </button>
                  )}
                  <button
                    onClick={() => onDismiss(originalIndex)}
                    className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                      text-white/25 hover:text-white/50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {insights.length === 0 && (
        <div className="text-center py-8 text-white/30 text-sm">
          All insights dismissed.
        </div>
      )}
    </div>
  );
});
