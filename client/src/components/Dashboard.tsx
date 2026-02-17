import { useState, useMemo, type RefObject } from 'react';
import type { Edge } from '@xyflow/react';
import type { FinancialPlan, DataGap } from 'shared/types';
import { MindMap, type MindMapHandle } from './mindmap/MindMap';
import { DetailPanel } from './detail/DetailPanel';
import { SummaryBar } from './summary/SummaryBar';
import { GapsChecklist } from './gaps/GapsChecklist';
import { X, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  data: FinancialPlan;
  mapRef: RefObject<HTMLDivElement | null>;
  mindMapRef: RefObject<MindMapHandle | null>;
  selectedNodeIds: Set<string>;
  onSelectNode: (id: string | null, additive: boolean) => void;
  highlightedNodeIds: Set<string>;
  onToggleHighlight: (nodeIds: string[]) => void;
  onClearHighlight: () => void;
  hoveredNodeIds: Set<string>;
  onHoverHighlight: (nodeIds: string[]) => void;
  onResolveGap: (gapIndex: number, value?: string) => void;
  onUpdateField: (nodeId: string, field: string, value: string) => void;
  userLinks: Edge[];
  onAddLink: (edge: Edge) => void;
  onRemoveLink: (edgeId: string) => void;
}

export function Dashboard({
  data, mapRef, mindMapRef, selectedNodeIds, onSelectNode,
  highlightedNodeIds, onToggleHighlight, onClearHighlight,
  hoveredNodeIds, onHoverHighlight,
  onResolveGap, onUpdateField,
  userLinks, onAddLink, onRemoveLink,
}: DashboardProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showGaps, setShowGaps] = useState(false);

  // Enrich gaps with nodeIds (fallback for data parsed before nodeId was added)
  const enrichedGaps = useMemo(() =>
    data.dataGaps.map((gap) => gap.nodeId ? gap : { ...gap, nodeId: resolveGapNodeId(gap, data) }),
    [data],
  );
  const hasGaps = enrichedGaps.length > 0;

  // The most recently selected node drives the detail panel
  const primaryNodeId = selectedNodeIds.size > 0 ? [...selectedNodeIds].pop()! : null;

  const handleSelectNode = (id: string | null, additive: boolean) => {
    onSelectNode(id, additive);
    if (id) {
      setRightPanelOpen(true);
      if (showGaps) onClearHighlight();
      setShowGaps(false);
    }
  };

  const closeRightPanel = () => {
    setRightPanelOpen(false);
    setShowGaps(false);
    onSelectNode(null, false);
    onClearHighlight();
  };

  const openGaps = () => {
    setShowGaps(true);
    setRightPanelOpen(true);
    onSelectNode(null, false);
  };

  const rightPanelVisible = rightPanelOpen && (primaryNodeId || showGaps);

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
              selectedNodeIds={selectedNodeIds}
              onSelectNode={handleSelectNode}
              highlightedNodeIds={highlightedNodeIds}
              hoveredNodeIds={hoveredNodeIds}
              userLinks={userLinks}
              onAddLink={onAddLink}
              onRemoveLink={onRemoveLink}
              onUpdateField={onUpdateField}
            />
          </div>

          {/* Gaps badge — top left floating over map */}
          {hasGaps && !showGaps && (
            <button
              onClick={openGaps}
              className="cursor-pointer absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-2
                bg-amber-500/15 backdrop-blur-md border border-amber-500/30 rounded-lg
                text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              {enrichedGaps.length} gaps
            </button>
          )}
        </div>

        {/* Summary bar — squeezes map height */}
        <SummaryBar data={data} onToggleHighlight={onToggleHighlight} onHoverHighlight={onHoverHighlight} />
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
              className="cursor-pointer text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {primaryNodeId && !showGaps && (
              <DetailPanel
                data={data}
                nodeId={primaryNodeId}
                onUpdateField={onUpdateField}
              />
            )}
            {showGaps && hasGaps && (
              <GapsChecklist
                gaps={enrichedGaps}
                entities={data.entities}
                onResolveGap={onResolveGap}
                onHoverGap={onHoverHighlight}
                onFocusGap={(nodeId) => {
                  onToggleHighlight([nodeId]);
                  mindMapRef.current?.focusNode(nodeId);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resolve a DataGap to the graph node ID it refers to (client-side fallback). */
function resolveGapNodeId(gap: DataGap, plan: FinancialPlan): string | undefined {
  // Entity-level gaps: match specific asset/liability, fall back to entity node
  if (gap.entityId) {
    const entity = plan.entities.find((e) => e.id === gap.entityId);
    if (entity) {
      if (gap.field === 'value') {
        const asset = entity.assets.find((a) => a.value === null && gap.description.includes(a.name));
        if (asset) return asset.id;
      }
      if (gap.field === 'amount') {
        const lib = entity.liabilities.find((l) => l.amount === null && gap.description.includes(l.name));
        if (lib) return lib.id;
      }
      // Broad fallback: match asset/liability by name in the description
      const assetByName = entity.assets.find((a) => gap.description.includes(a.name));
      if (assetByName) return assetByName.id;
      const libByName = entity.liabilities.find((l) => gap.description.includes(l.name));
      if (libByName) return libByName.id;
    }
    return gap.entityId;
  }

  // Client-level gaps
  if (['age', 'income', 'superBalance'].includes(gap.field)) {
    const client = plan.clients.find((c) => gap.description.includes(c.name));
    if (client) return client.id;
    // Could be a family member dependant age gap
    for (const m of plan.familyMembers ?? []) {
      if (gap.description.includes(m.name)) return m.id;
      for (const gc of m.children ?? []) {
        if (gap.description.includes(gc.name)) return gc.id;
      }
    }
  }

  // Personal asset/liability gaps
  if (gap.field === 'value') {
    const asset = plan.personalAssets.find((a) => a.value === null && gap.description.includes(a.name));
    if (asset) return asset.id;
  }
  if (gap.field === 'amount') {
    const lib = plan.personalLiabilities.find((l) => l.amount === null && gap.description.includes(l.name));
    if (lib) return lib.id;
  }

  // Estate planning gaps
  if (['status', 'primaryPerson'].includes(gap.field)) {
    for (const item of plan.estatePlanning ?? []) {
      const client = plan.clients.find((c) => c.id === item.clientId);
      if (client && gap.description.includes(client.name)) return item.id;
    }
  }

  return undefined;
}
