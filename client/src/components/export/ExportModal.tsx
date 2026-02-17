import { useState, useEffect } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { FinancialPlan } from 'shared/types';
import { netWorth, totalAssets, totalLiabilities, formatAUD } from '../../utils/calculations';

export interface ExportOptions {
  title: string;
  preparedFor: string;
  preparedBy: string;
  includeSummary: boolean;
  includeGaps: boolean;
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
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeGaps, setIncludeGaps] = useState(hasGaps);
  const [mapThumb, setMapThumb] = useState<string | null>(null);

  // Capture a thumbnail of the map on mount
  useEffect(() => {
    if (!mapElement) return;
    toPng(mapElement, { quality: 0.6, pixelRatio: 0.4, backgroundColor: '#1a1a2e' })
      .then(setMapThumb)
      .catch(() => {});
  }, [mapElement]);

  const handleExport = () => {
    onExport({ title, preparedFor, preparedBy, includeSummary, includeGaps });
  };

  const nw = netWorth(data);
  const ta = totalAssets(data);
  const tl = totalLiabilities(data);

  // Count pages
  const pageCount = 1 + (includeSummary ? 1 : 0) + (includeGaps && hasGaps ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden">
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

          {/* PDF Page Previews */}
          <div>
            <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-2">Preview</label>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {/* Page 1: Map */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div className="w-[140px] h-[99px] rounded-md border border-white/15 bg-white overflow-hidden shadow-md shadow-black/20 relative">
                  {/* Accent bar */}
                  <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                  {/* Title */}
                  <div className="px-2 pt-1">
                    <div className="h-[3px] w-16 bg-gray-800 rounded-full mb-0.5" />
                    <div className="h-[1.5px] w-10 bg-gray-300 rounded-full" />
                  </div>
                  {/* Map thumbnail */}
                  {mapThumb ? (
                    <img src={mapThumb} alt="" className="w-full h-[70px] object-contain mt-0.5" />
                  ) : (
                    <div className="flex-1 flex items-center justify-center mt-2">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-400 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-white/40">Page 1</span>
              </div>

              {/* Page 2: Summary */}
              <div className={`shrink-0 flex flex-col items-center gap-1 transition-all duration-200 ${includeSummary ? 'opacity-100' : 'opacity-25 scale-95'}`}>
                <div className="w-[140px] h-[99px] rounded-md border border-white/15 bg-white overflow-hidden shadow-md shadow-black/20">
                  {/* Accent bar */}
                  <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                  <div className="px-2 pt-1.5">
                    <div className="h-[3px] w-14 bg-gray-800 rounded-full mb-1.5" />
                    {/* Three metric cards */}
                    <div className="flex gap-1 mb-1.5">
                      <div className="flex-1 bg-gray-50 rounded-sm p-1 border-l-2 border-emerald-400">
                        <div className="h-[1.5px] w-5 bg-gray-300 rounded-full mb-0.5" />
                        <div className="text-[5px] font-bold text-gray-800 leading-none">{formatAUD(nw).replace('$', '$')}</div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-sm p-1 border-l-2 border-blue-400">
                        <div className="h-[1.5px] w-5 bg-gray-300 rounded-full mb-0.5" />
                        <div className="text-[5px] font-bold text-gray-800 leading-none">{formatAUD(ta).replace('$', '$')}</div>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-sm p-1 border-l-2 border-red-400">
                        <div className="h-[1.5px] w-5 bg-gray-300 rounded-full mb-0.5" />
                        <div className="text-[5px] font-bold text-gray-800 leading-none">{formatAUD(tl).replace('$', '$')}</div>
                      </div>
                    </div>
                    {/* Table rows */}
                    <div className="h-[2.5px] w-full bg-gray-100 rounded-full mb-[2px]" />
                    {data.entities.slice(0, 4).map((_, i) => (
                      <div key={i} className={`h-[2.5px] w-full rounded-full mb-[2px] ${i % 2 === 0 ? 'bg-gray-50' : 'bg-transparent'}`}>
                        <div className="h-full w-2/3 bg-gray-200 rounded-full" />
                      </div>
                    ))}
                    <div className="h-[0.5px] w-full bg-gray-300 mt-1 mb-[2px]" />
                    <div className="h-[2.5px] w-1/2 bg-gray-400 rounded-full" />
                  </div>
                </div>
                <span className="text-[9px] text-white/40">{includeSummary ? `Page 2` : 'Off'}</span>
              </div>

              {/* Page 3: Gaps */}
              {hasGaps && (
                <div className={`shrink-0 flex flex-col items-center gap-1 transition-all duration-200 ${includeGaps ? 'opacity-100' : 'opacity-25 scale-95'}`}>
                  <div className="w-[140px] h-[99px] rounded-md border border-white/15 bg-white overflow-hidden shadow-md shadow-black/20">
                    {/* Accent bar */}
                    <div className="h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
                    <div className="px-2 pt-1.5">
                      <div className="h-[3px] w-16 bg-gray-800 rounded-full mb-0.5" />
                      <div className="h-[1.5px] w-20 bg-gray-300 rounded-full mb-1.5" />
                      {/* Gap items */}
                      {data.dataGaps.slice(0, 6).map((_, i) => (
                        <div key={i} className={`flex items-center gap-1 mb-[3px] ${i % 2 === 0 ? 'bg-gray-50' : ''} rounded-sm px-0.5 py-[1px]`}>
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 flex items-center justify-center">
                            <span className="text-[3px] text-white font-bold">{i + 1}</span>
                          </div>
                          <div className="h-[1.5px] flex-1 bg-gray-300 rounded-full" />
                        </div>
                      ))}
                      {data.dataGaps.length > 6 && (
                        <div className="text-[4px] text-gray-400 text-center">+{data.dataGaps.length - 6} more</div>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-white/40">
                    {includeGaps ? `Page ${includeSummary ? 3 : 2}` : 'Off'}
                  </span>
                </div>
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
            disabled={exporting}
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
