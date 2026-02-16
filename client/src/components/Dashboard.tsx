import { useState, type RefObject } from 'react';
import type { FinancialPlan } from 'shared/types';
import { MindMap, type MindMapHandle } from './mindmap/MindMap';
import { DetailPanel } from './detail/DetailPanel';
import { SummaryBar } from './summary/SummaryBar';
import { GapsChecklist } from './gaps/GapsChecklist';
import { X, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  data: FinancialPlan;
  mapRef: RefObject<HTMLDivElement | null>;
  mindMapRef: RefObject<MindMapHandle | null>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  highlightedNodeIds: Set<string>;
  onToggleHighlight: (nodeIds: string[]) => void;
  onClearHighlight: () => void;
  onResolveGap: (gapIndex: number, value?: string) => void;
  onUpdateField: (nodeId: string, field: string, value: string) => void;
}

export function Dashboard({
  data, mapRef, mindMapRef, selectedNodeId, onSelectNode,
  highlightedNodeIds, onToggleHighlight, onClearHighlight,
  onResolveGap, onUpdateField,
}: DashboardProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showGaps, setShowGaps] = useState(false);

  const hasGaps = data.dataGaps.length > 0;

  const handleSelectNode = (id: string | null) => {
    onSelectNode(id);
    if (id) {
      setRightPanelOpen(true);
      setShowGaps(false);
    }
  };

  const closeRightPanel = () => {
    setRightPanelOpen(false);
    setShowGaps(false);
    onSelectNode(null);
  };

  const openGaps = () => {
    setShowGaps(true);
    setRightPanelOpen(true);
    onSelectNode(null);
  };

  const rightPanelVisible = rightPanelOpen && (selectedNodeId || showGaps);

  return (
    <div className="w-full h-full flex">
      {/* Left column: map + summary bar stacked vertically */}
      <div className="flex-1 min-w-0 flex flex-col transition-all duration-300 ease-out">
        {/* Map — takes remaining height */}
        <div className="flex-1 min-h-0 relative">
          <div ref={mapRef} className="absolute inset-0 bg-[#1a1a2e]">
            <MindMap
              ref={mindMapRef}
              data={data}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              highlightedNodeIds={highlightedNodeIds}
            />
          </div>

          {/* Gaps badge — top left floating over map */}
          {hasGaps && !showGaps && (
            <button
              onClick={openGaps}
              className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-2
                bg-amber-500/15 backdrop-blur-md border border-amber-500/30 rounded-lg
                text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              {data.dataGaps.length} gaps
            </button>
          )}
        </div>

        {/* Summary bar — squeezes map height */}
        <SummaryBar data={data} onToggleHighlight={onToggleHighlight} />
      </div>

      {/* Right panel — always rendered, width animates between 0 and 384px */}
      <div
        className={`
          shrink-0 bg-[#0f0f1a] border-l border-white/10 flex flex-col overflow-hidden
          transition-[width] duration-300 ease-out
          ${rightPanelVisible ? 'w-96' : 'w-0 border-l-0'}
        `}
      >
        <div className="w-96 h-full flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="font-semibold text-white/90 text-sm whitespace-nowrap">
              {showGaps ? 'Information Needed' : 'Details'}
            </h3>
            <button
              onClick={closeRightPanel}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {selectedNodeId && !showGaps && (
              <DetailPanel
                data={data}
                nodeId={selectedNodeId}
                onUpdateField={onUpdateField}
              />
            )}
            {showGaps && hasGaps && (
              <GapsChecklist gaps={data.dataGaps} entities={data.entities} onResolveGap={onResolveGap} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
