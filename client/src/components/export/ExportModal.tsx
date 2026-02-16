import { useState } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import type { FinancialPlan } from 'shared/types';

export interface ExportOptions {
  title: string;
  preparedFor: string;
  preparedBy: string;
  includeSummary: boolean;
  includeGaps: boolean;
}

interface ExportModalProps {
  data: FinancialPlan;
  exporting: boolean;
  onExport: (options: ExportOptions) => void;
  onClose: () => void;
}

export function ExportModal({ data, exporting, onExport, onClose }: ExportModalProps) {
  const clientNames = data.clients.map((c) => c.name).join(' & ');
  const hasGaps = data.dataGaps.length > 0;

  const [title, setTitle] = useState('Financial Structure Map');
  const [preparedFor, setPreparedFor] = useState(clientNames);
  const [preparedBy, setPreparedBy] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(hasGaps);

  const handleExport = () => {
    onExport({ title, preparedFor, preparedBy, includeSummary, includeGaps });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <FileDown className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white/90">Export PDF</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg
                text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
            />
          </div>

          {/* Prepared for */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-1.5">Prepared for</label>
            <input
              type="text"
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
              placeholder="Client name(s)"
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg
                text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
            />
          </div>

          {/* Prepared by */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-1.5">Prepared by</label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Adviser name (optional)"
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg
                text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
            />
          </div>

          {/* Include options */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-2.5">Include pages</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5
                cursor-pointer hover:bg-white/[0.05] transition-colors">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <div>
                  <div className="text-sm text-white/70">Summary statistics</div>
                  <div className="text-[11px] text-white/30">Net worth, assets, liabilities, entity breakdown</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5
                transition-colors ${hasGaps ? 'cursor-pointer hover:bg-white/[0.05]' : 'opacity-40 cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  checked={includeGaps && hasGaps}
                  onChange={(e) => setIncludeGaps(e.target.checked)}
                  disabled={!hasGaps}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <div>
                  <div className="text-sm text-white/70">Information needed</div>
                  <div className="text-[11px] text-white/30">
                    {hasGaps ? `${data.dataGaps.length} gaps identified` : 'No gaps — all data complete'}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white
              bg-gradient-to-r from-blue-600 to-purple-600
              hover:from-blue-500 hover:to-purple-500
              disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {exporting ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
