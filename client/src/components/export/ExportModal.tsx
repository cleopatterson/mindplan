import { useState, useEffect } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { FinancialPlan } from 'shared/types';
import { netWorth, totalAssets, totalLiabilities, formatAUD } from '../../utils/calculations';

export interface ExportOptions {
  title: string;
  preparedFor: string;
  preparedBy: string;
  includeMap: boolean;
  includeSummary: boolean;
  includeGaps: boolean;
  includeAllocation: boolean;
  includeEstate: boolean;
  includeFamily: boolean;
}

interface ExportModalProps {
  data: FinancialPlan;
  mapElement: HTMLElement | null;
  exporting: boolean;
  onExport: (options: ExportOptions) => void;
  onClose: () => void;
}

export function ExportModal({ data, mapElement, exporting, onExport, onClose }: ExportModalProps) {
  const clientNames = data.clients.map((c) => c.name).join(' & ');
  const hasGaps = data.dataGaps.length > 0;

  const [title, setTitle] = useState('Financial Structure Map');
  const [preparedFor, setPreparedFor] = useState(clientNames);
  const [preparedBy, setPreparedBy] = useState('');
  const [includeMap, setIncludeMap] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(hasGaps);
  const [includeAllocation, setIncludeAllocation] = useState(true);
  const [includeEstate, setIncludeEstate] = useState(data.estatePlanning.length > 0);
  const [includeFamily, setIncludeFamily] = useState(data.familyMembers.length > 0);
  const [mapThumb, setMapThumb] = useState<string | null>(null);

  // Capture a thumbnail of the map on mount
  useEffect(() => {
    if (!mapElement) return;
    toPng(mapElement, { quality: 0.6, pixelRatio: 0.4, backgroundColor: '#ffffff' })
      .then(setMapThumb)
      .catch(() => {});
  }, [mapElement]);

  const handleExport = () => {
    onExport({ title, preparedFor, preparedBy, includeMap, includeSummary, includeGaps, includeAllocation, includeEstate, includeFamily });
  };

  const nw = netWorth(data);
  const ta = totalAssets(data);
  const tl = totalLiabilities(data);

  const hasEstate = data.estatePlanning.length > 0;
  const hasFamily = data.familyMembers.length > 0;

  // Count pages
  const pageCount =
    (includeMap ? 1 : 0) +
    (includeSummary ? 1 : 0) +
    (includeGaps && hasGaps ? 1 : 0) +
    (includeAllocation ? 1 : 0) +
    (includeEstate && hasEstate ? 1 : 0) +
    (includeFamily && hasFamily ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <FileDown className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white/90">Export PDF</h2>
            <span className="text-[11px] text-white/30">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
          </div>
          <button onClick={onClose} className="cursor-pointer text-white/30 hover:text-white/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable so it doesn't overflow on smaller screens */}
        <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-3">
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
                placeholder="Adviser name"
                className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg
                  text-white/80 placeholder-white/25 focus:outline-none focus:border-blue-400/50"
              />
            </div>
          </div>

          {/* Include options — 2 rows of 3 */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-2">Include pages</label>
            <div className="grid grid-cols-3 gap-2">
              <PageToggle label="Structure map" checked={includeMap} onChange={setIncludeMap} />
              <PageToggle label="Summary" checked={includeSummary} onChange={setIncludeSummary} />
              <PageToggle label="Allocation" checked={includeAllocation} onChange={setIncludeAllocation} />
              <PageToggle label="Estate" checked={includeEstate && hasEstate} onChange={setIncludeEstate} disabled={!hasEstate} />
              <PageToggle label="Family" checked={includeFamily && hasFamily} onChange={setIncludeFamily} disabled={!hasFamily} />
              <PageToggle label={hasGaps ? `Gaps (${data.dataGaps.length})` : 'Gaps'} checked={includeGaps && hasGaps} onChange={setIncludeGaps} disabled={!hasGaps} />
            </div>
          </div>

          {/* PDF Page Previews */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-2">Preview</label>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* Map */}
              <PreviewThumb label="Map" on={includeMap}>
                <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                <div className="px-2 pt-1">
                  <div className="h-[3px] w-16 bg-gray-800 rounded-full mb-0.5" />
                  <div className="h-[1.5px] w-10 bg-gray-300 rounded-full" />
                </div>
                {mapThumb ? (
                  <img src={mapThumb} alt="" className="w-full h-[56px] object-contain mt-0.5" />
                ) : (
                  <div className="flex-1 flex items-center justify-center mt-2">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
                  </div>
                )}
              </PreviewThumb>

              {/* Summary */}
              <PreviewThumb label="Summary" on={includeSummary}>
                <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                <div className="px-2 pt-1.5">
                  <div className="h-[3px] w-14 bg-gray-800 rounded-full mb-1.5" />
                  <div className="flex gap-1 mb-1.5">
                    {[
                      { border: 'border-emerald-400', val: nw },
                      { border: 'border-blue-400', val: ta },
                      { border: 'border-red-400', val: tl },
                    ].map(({ border, val }, i) => (
                      <div key={i} className={`flex-1 bg-gray-50 rounded-sm p-1 border-l-2 ${border}`}>
                        <div className="h-[1.5px] w-5 bg-gray-300 rounded-full mb-0.5" />
                        <div className="text-[5px] font-bold text-gray-800 leading-none">{formatAUD(val)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-[2.5px] w-full bg-gray-100 rounded-full mb-[2px]" />
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-[2.5px] w-full rounded-full mb-[2px] ${i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                      <div className="h-full w-2/3 bg-gray-200 rounded-full" />
                    </div>
                  ))}
                </div>
              </PreviewThumb>

              {/* Allocation */}
              <PreviewThumb label="Allocation" on={includeAllocation}>
                <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                <div className="px-2 pt-1.5">
                  <div className="h-[3px] w-14 bg-gray-800 rounded-full mb-1.5" />
                  {/* Miniature pie */}
                  <div className="flex justify-center mb-1">
                    <div className="w-10 h-10 rounded-full border-[3px] border-emerald-400 border-t-blue-400 border-r-amber-400" />
                  </div>
                  {/* Legend lines */}
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-1 mb-[2px]">
                      <div className={`w-1.5 h-1.5 rounded-sm ${['bg-emerald-400', 'bg-blue-400', 'bg-amber-400'][i]}`} />
                      <div className="h-[1.5px] flex-1 bg-gray-200 rounded-full" />
                    </div>
                  ))}
                </div>
              </PreviewThumb>

              {/* Estate */}
              {hasEstate && (
                <PreviewThumb label="Estate" on={includeEstate}>
                  <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                  <div className="px-2 pt-1.5">
                    <div className="h-[3px] w-12 bg-gray-800 rounded-full mb-1.5" />
                    {/* Grid cells */}
                    <div className="grid grid-cols-4 gap-[2px]">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`h-3 rounded-sm ${['bg-emerald-200', 'bg-red-200', 'bg-amber-200', 'bg-gray-200'][i % 4]}`} />
                      ))}
                    </div>
                  </div>
                </PreviewThumb>
              )}

              {/* Family */}
              {hasFamily && (
                <PreviewThumb label="Family" on={includeFamily}>
                  <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                  <div className="px-2 pt-1.5">
                    <div className="h-[3px] w-10 bg-gray-800 rounded-full mb-1.5" />
                    {/* Tree nodes */}
                    <div className="flex justify-center mb-1">
                      <div className="w-8 h-3 rounded bg-blue-100 border border-blue-300" />
                    </div>
                    <div className="flex justify-center gap-1">
                      {[0, 1].map((i) => (
                        <div key={i} className="w-6 h-2.5 rounded bg-amber-100 border border-amber-300" />
                      ))}
                    </div>
                  </div>
                </PreviewThumb>
              )}

              {/* Gaps */}
              {hasGaps && (
                <PreviewThumb label="Gaps" on={includeGaps}>
                  <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                  <div className="px-2 pt-1.5">
                    <div className="h-[3px] w-16 bg-gray-800 rounded-full mb-0.5" />
                    <div className="h-[1.5px] w-20 bg-gray-300 rounded-full mb-1.5" />
                    {data.dataGaps.slice(0, 5).map((_, i) => (
                      <div key={i} className={`flex items-center gap-1 mb-[3px] ${i % 2 === 0 ? 'bg-gray-50' : ''} rounded-sm px-0.5 py-[1px]`}>
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <div className="h-[1.5px] flex-1 bg-gray-300 rounded-full" />
                      </div>
                    ))}
                  </div>
                </PreviewThumb>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || pageCount === 0}
            className="cursor-pointer flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white
              bg-gradient-to-r from-blue-600 to-purple-600
              hover:from-blue-500 hover:to-purple-500
              disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
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

// ── Sub-components ──

function PageToggle({ label, checked, onChange, disabled }: {
  label: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03] border border-white/5
      transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.05]'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-3.5 h-3.5 rounded accent-blue-500"
      />
      <span className="text-xs text-white/70">{label}</span>
    </label>
  );
}

function PreviewThumb({ label, on, children }: {
  label: string; on: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`shrink-0 flex flex-col items-center gap-1 transition-all duration-200 ${on ? 'opacity-100' : 'opacity-25 scale-95'}`}>
      <div className="w-[120px] h-[85px] rounded-md border border-white/15 bg-white overflow-hidden shadow-md shadow-black/20">
        {children}
      </div>
      <span className="text-[9px] text-white/40">{on ? label : 'Off'}</span>
    </div>
  );
}
