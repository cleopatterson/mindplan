import { useState, useMemo, useCallback, type RefObject } from 'react';
import type { Edge } from '@xyflow/react';
import type { FinancialPlan, DataGap, Insight } from 'shared/types';
import { MindMap, type MindMapHandle } from './mindmap/MindMap';
import { DetailPanel } from './detail/DetailPanel';
import { SummaryBar } from './summary/SummaryBar';
import { SummaryDetailPanel } from './summary/SummaryDetailPanel';
import { GapsChecklist } from './gaps/GapsChecklist';
import { InsightsBadge } from './insights/InsightsBadge';
import { InsightsPanel } from './insights/InsightsPanel';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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
  insights: Insight[] | null;
  insightsLoading: boolean;
  onDismissInsight: (index: number) => void;
}

export function Dashboard({
  data, mapRef, mindMapRef, selectedNodeIds, onSelectNode,
  highlightedNodeIds, onToggleHighlight, onClearHighlight,
  hoveredNodeIds, onHoverHighlight,
  onResolveGap, onUpdateField,
  userLinks, onAddLink, onRemoveLink,
  insights, insightsLoading, onDismissInsight,
}: DashboardProps) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Enrich gaps with nodeIds (fallback for data parsed before nodeId was added)
  const enrichedGaps = useMemo(() =>
    data.dataGaps.map((gap) => gap.nodeId ? gap : { ...gap, nodeId: resolveGapNodeId(gap, data) }),
    [data],
  );
  const hasGaps = enrichedGaps.length > 0;

  // The most recently selected node drives the detail panel
  const primaryNodeId = selectedNodeIds.size > 0 ? [...selectedNodeIds].pop()! : null;

  const handleSelectNode = useCallback((id: string | null, additive: boolean) => {
    onSelectNode(id, additive);
    if (id) {
      setRightPanelOpen(true);
      setShowGaps((prev) => { if (prev) onClearHighlight(); return false; });
      setShowInsights(false);
      setActiveCard(null);
    }
  }, [onSelectNode, onClearHighlight]);

  const handleCardClick = useCallback((id: string | null, nodeIds: string[]) => {
    if (id) {
      setActiveCard(id);
      setRightPanelOpen(true);
      setShowGaps(false);
      setShowInsights(false);
      onSelectNode(null, false);
      onToggleHighlight(nodeIds);
    } else {
      setActiveCard(null);
      onToggleHighlight([]);
    }
  }, [onSelectNode, onToggleHighlight]);

  const closeRightPanel = useCallback(() => {
    setRightPanelOpen(false);
    setShowGaps(false);
    setShowInsights(false);
    setActiveCard(null);
    onSelectNode(null, false);
    onClearHighlight();
  }, [onSelectNode, onClearHighlight]);

  const openGaps = useCallback(() => {
    setShowGaps(true);
    setShowInsights(false);
    setRightPanelOpen(true);
    setActiveCard(null);
    onSelectNode(null, false);
  }, [onSelectNode]);

  const openInsights = useCallback(() => {
    setShowInsights(true);
    setShowGaps(false);
    setRightPanelOpen(true);
    setActiveCard(null);
    onSelectNode(null, false);
    onClearHighlight();
  }, [onSelectNode, onClearHighlight]);

  const handleInsightFocus = useCallback((nodeIds: string[]) => {
    if (nodeIds.length > 0) {
      onToggleHighlight(nodeIds);
      mindMapRef.current?.focusNode(nodeIds[0]);
    }
  }, [onToggleHighlight, mindMapRef]);

  const rightPanelVisible = rightPanelOpen && (primaryNodeId || showGaps || showInsights || activeCard);

  // Panel header title
  const panelTitle = showInsights ? 'AI Insights' : showGaps ? 'Information Needed' : activeCard ? 'Summary' : 'Details';

  return (
    <div className="w-full h-full flex" data-theme={theme}>
      {/* Left column: map + summary bar stacked vertically */}
      <div className="flex-1 min-w-0 flex flex-col transition-all duration-300 ease-out">
        {/* Map — takes remaining height */}
        <div className="flex-1 min-h-0 relative">
          <div ref={mapRef} className={`absolute inset-0 ${isDark ? 'bg-[#1a1a2e]' : 'bg-slate-100'}`}>
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
            />
          </div>

          {/* Floating badges — top left over map */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
            {hasGaps && !showGaps && (
              <button
                onClick={openGaps}
                className="gaps-badge cursor-pointer flex items-center gap-2 px-3 py-2
                  bg-amber-500/15 backdrop-blur-md border border-amber-500/30 rounded-lg
                  text-amber-300 text-sm font-medium hover:bg-amber-500/25 transition-all"
              >
                <AlertTriangle className="w-4 h-4" />
                {enrichedGaps.length} gaps
              </button>
            )}
            {(insightsLoading || insights) && (
              <InsightsBadge
                insights={insights}
                loading={insightsLoading}
                active={showInsights}
                onClick={openInsights}
              />
            )}
          </div>

        </div>

        {/* Summary bar — squeezes map height */}
        <SummaryBar
          data={data}
          activeCard={activeCard}
          onCardClick={handleCardClick}
          onHoverHighlight={onHoverHighlight}
        />
      </div>

      {/* Right panel — always rendered, width animates between 0 and 384px */}
      <div
        className={`
          right-panel shrink-0 border-l flex flex-col overflow-hidden
          transition-[width] duration-300 ease-out
          ${isDark ? 'bg-[#0f0f1a] border-white/10' : 'bg-white border-gray-200'}
          ${rightPanelVisible ? 'w-96' : 'w-0 border-l-0'}
        `}
      >
        <div className="w-96 h-full flex flex-col">
          <div className={`panel-header shrink-0 flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <h3 className={`panel-title font-semibold text-sm whitespace-nowrap ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
              {panelTitle}
            </h3>
            <button
              onClick={closeRightPanel}
              className={`panel-close cursor-pointer transition-colors ${isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="panel-content flex-1 overflow-y-auto p-5 space-y-4">
            {primaryNodeId && !showGaps && !activeCard && (
              <DetailPanel
                data={data}
                nodeId={primaryNodeId}
                onUpdateField={onUpdateField}
              />
            )}
            {activeCard && !showGaps && (
              <SummaryDetailPanel
                data={data}
                activeCard={activeCard}
              />
            )}
            {showInsights && insights && (
              <InsightsPanel
                insights={insights}
                onDismiss={onDismissInsight}
                onFocus={handleInsightFocus}
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
