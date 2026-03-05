import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  type SankeyNode as D3SankeyNode,
  type SankeyLink as D3SankeyLink,
} from 'd3-sankey';
import { useSankeyData, type SankeyNode, type SankeyLink } from '../../hooks/useSankeyData';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAUD } from '../../utils/calculations';
import type { FinancialPlan } from 'shared/types';

interface SankeyViewProps {
  data: FinancialPlan;
  mapRef: RefObject<HTMLDivElement | null>;
}

type LayoutNode = D3SankeyNode<SankeyNode, SankeyLink>;
type LayoutLink = D3SankeyLink<SankeyNode, SankeyLink>;

const COLUMN_LABELS = ['Income', 'Structures', 'Assets'];
const NODE_PAD = 24;
const NODE_WIDTH = 20;
const MARGIN = { top: 48, right: 160, bottom: 24, left: 160 };

export function SankeyView({ data, mapRef }: SankeyViewProps) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const sankeyData = useSankeyData(data);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build d3-sankey layout
  const { layoutNodes, layoutLinks } = (() => {
    if (sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }

    const nodeIdSet = new Set(sankeyData.nodes.map((n) => n.id));
    const d3Nodes = sankeyData.nodes.map((n) => ({ ...n }));
    const d3Links = sankeyData.links
      .filter((l) => nodeIdSet.has(l.source) && nodeIdSet.has(l.target))
      .map((l) => ({
        ...l,
        source: l.source,
        target: l.target,
        value: l.value,
      }));

    if (d3Links.length === 0) {
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }

    try {
      const generator = d3Sankey<SankeyNode, SankeyLink>()
        .nodeId((d: any) => d.id)
        .nodeWidth(NODE_WIDTH)
        .nodePadding(NODE_PAD)
        .nodeAlign((node: any) => node.column ?? 0)
        .extent([
          [MARGIN.left, MARGIN.top],
          [size.width - MARGIN.right, size.height - MARGIN.bottom],
        ]);

      const { nodes: ln, links: ll } = generator({
        nodes: d3Nodes as any,
        links: d3Links as any,
      });

      return { layoutNodes: ln as LayoutNode[], layoutLinks: ll as LayoutLink[] };
    } catch (e) {
      console.error('Sankey layout error:', e);
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }
  })();

  const linkPath = sankeyLinkHorizontal();

  // Determine which nodes/links are connected to hovered element
  const connectedNodeIds = new Set<string>();
  if (hoveredNodeId) {
    connectedNodeIds.add(hoveredNodeId);
    for (const link of layoutLinks) {
      const srcId = (link.source as any).id as string;
      const tgtId = (link.target as any).id as string;
      if (srcId === hoveredNodeId || tgtId === hoveredNodeId) {
        connectedNodeIds.add(srcId);
        connectedNodeIds.add(tgtId);
      }
    }
  }
  if (hoveredLink) {
    connectedNodeIds.add(hoveredLink.source);
    connectedNodeIds.add(hoveredLink.target);
  }

  const isHighlighting = hoveredNodeId !== null || hoveredLink !== null;

  const handleNodeEnter = useCallback((e: React.MouseEvent, node: LayoutNode) => {
    const sn = node as any;
    setHoveredNodeId(sn.id);
    setHoveredLink(null);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        content: `${sn.label}: ${formatAUD(sn.value)}`,
      });
    }
  }, []);

  const handleLinkEnter = useCallback((e: React.MouseEvent, link: LayoutLink) => {
    const src = link.source as any;
    const tgt = link.target as any;
    setHoveredLink({ source: src.id, target: tgt.id });
    setHoveredNodeId(null);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 12,
        content: `${src.label} → ${tgt.label}: ${formatAUD(link.value)}`,
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!tooltip) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top - 12 } : null);
    }
  }, [tooltip]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
    setHoveredLink(null);
    setTooltip(null);
  }, []);

  // Column label x-positions
  const columnXPositions = (() => {
    const cols: Record<number, number[]> = { 0: [], 1: [], 2: [] };
    for (const node of layoutNodes) {
      const col = (node as unknown as SankeyNode).column;
      cols[col]?.push((node.x0! + node.x1!) / 2);
    }
    return Object.entries(cols).map(([col, xs]) => ({
      col: Number(col),
      x: xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
    }));
  })();

  if (sankeyData.nodes.length === 0) {
    return (
      <div ref={mapRef} className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1a1a2e]' : 'bg-slate-100'}`}>
        <div ref={containerRef} className="w-full h-full flex items-center justify-center">
          <p className={`text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
            No wealth flow data to display
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapRef} className={`w-full h-full ${isDark ? 'bg-[#1a1a2e]' : 'bg-slate-100'}`}>
      <div ref={containerRef} className="w-full h-full relative">
        <svg
          width={size.width}
          height={size.height}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
        >
          {/* Column headers */}
          {columnXPositions.map(({ col, x }) => x > 0 && (
            <text
              key={col}
              x={x}
              y={24}
              textAnchor="middle"
              className="text-xs font-medium"
              fill={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)'}
            >
              {COLUMN_LABELS[col]}
            </text>
          ))}

          {/* Links */}
          <g fill="none">
            {layoutLinks.map((link, i) => {
              const src = link.source as any;
              const tgt = link.target as any;
              const srcId = src.id as string;
              const tgtId = tgt.id as string;
              const isLiability = (link as any).isLiability;
              const isConnected = connectedNodeIds.has(srcId) && connectedNodeIds.has(tgtId);
              const dimmed = isHighlighting && !isConnected;

              // For hovered link, check exact match
              const isThisLink = hoveredLink && hoveredLink.source === srcId && hoveredLink.target === tgtId;
              const baseOpacity = isLiability ? 0.35 : 0.25;
              const opacity = dimmed ? 0.05 : isThisLink ? 0.6 : baseOpacity;

              return (
                <path
                  key={i}
                  d={linkPath(link as any) || ''}
                  stroke={isLiability ? '#ef4444' : (src.color || '#3b82f6')}
                  strokeWidth={Math.max(1, link.width || 1)}
                  strokeOpacity={opacity}
                  onMouseEnter={(e) => handleLinkEnter(e, link)}
                  onMouseLeave={handleMouseLeave}
                  className="cursor-pointer"
                />
              );
            })}
          </g>

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const sn = node as any;
            const x0 = node.x0 ?? 0;
            const y0 = node.y0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y1 = node.y1 ?? 0;
            const w = x1 - x0;
            const h = y1 - y0;
            const dimmed = isHighlighting && !connectedNodeIds.has(sn.id);

            // Label positioning: left of col-0 nodes, right of col-2 nodes, right of col-1 nodes
            const labelX = sn.column === 0 ? x0 - 8 : x1 + 8;
            const labelAnchor = sn.column === 0 ? 'end' : 'start';

            return (
              <g
                key={sn.id}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  fill={sn.color}
                  rx={3}
                  opacity={dimmed ? 0.15 : 0.85}
                />
                <text
                  x={labelX}
                  y={y0 + h / 2}
                  dy="0.35em"
                  textAnchor={labelAnchor}
                  className="text-xs"
                  fill={isDark ? (dimmed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)') : (dimmed ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.7)')}
                >
                  {sn.label}
                </text>
                {/* Value beneath label for non-dimmed nodes */}
                {!dimmed && h > 12 && (
                  <text
                    x={labelX}
                    y={y0 + h / 2 + 14}
                    dy="0.35em"
                    textAnchor={labelAnchor}
                    className="text-[10px]"
                    fill={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                  >
                    {formatAUD(sn.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className={`absolute pointer-events-none px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg whitespace-nowrap
              ${isDark ? 'bg-[#0f0f1a] border border-white/10 text-white/90' : 'bg-white border border-gray-200 text-gray-900'}`}
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}
