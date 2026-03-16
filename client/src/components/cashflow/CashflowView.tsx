import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import {
  sankey as d3Sankey,
  type SankeyNode as D3SankeyNode,
  type SankeyLink as D3SankeyLink,
} from 'd3-sankey';
import { useCashflowData, type SankeyNode, type SankeyLink } from '../../hooks/useCashflowData';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAUD } from '../../utils/calculations';
import type { FinancialPlan } from 'shared/types';

interface CashflowViewProps {
  data: FinancialPlan;
  mapRef: RefObject<HTMLDivElement | null>;
}

type LayoutNode = D3SankeyNode<SankeyNode, SankeyLink>;
type LayoutLink = D3SankeyLink<SankeyNode, SankeyLink>;

const COLUMN_LABELS = ['INCOME SOURCES', '', 'ALLOCATION'];
const NODE_PAD = 18;
const NODE_WIDTH = 16;
const MARGIN = { top: 48, right: 200, bottom: 24, left: 200 };
const SUMMARY_HEIGHT = 56;
const ANIM_DURATION = 1800;

/** Build a filled bezier path between source and target bands (like the dorothy prototype).
 *  d3-sankey's link.y0/y1 are the CENTER of the band — offset by half width to get top/bottom edges. */
function linkFillPath(link: LayoutLink): string {
  const src = link.source as any;
  const tgt = link.target as any;
  const x0 = src.x1 ?? 0; // right edge of source
  const x1 = tgt.x0 ?? 0; // left edge of target
  const mx = (x0 + x1) / 2;
  const halfW = (link.width ?? 0) / 2;
  const sy0 = (link.y0 ?? 0) - halfW; // top edge at source
  const sy1 = (link.y0 ?? 0) + halfW; // bottom edge at source
  const ty0 = (link.y1 ?? 0) - halfW; // top edge at target
  const ty1 = (link.y1 ?? 0) + halfW; // bottom edge at target

  return `M${x0},${sy0} C${mx},${sy0} ${mx},${ty0} ${x1},${ty0} L${x1},${ty1} C${mx},${ty1} ${mx},${sy1} ${x0},${sy1} Z`;
}

export function CashflowView({ data, mapRef }: CashflowViewProps) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const cashflowData = useCashflowData(data);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [animProgress, setAnimProgress] = useState(0);
  const animStartRef = useRef<number | null>(null);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height: height - SUMMARY_HEIGHT });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Entrance animation
  useEffect(() => {
    if (cashflowData.nodes.length === 0) return;
    animStartRef.current = null;
    let raf: number;
    const tick = (ts: number) => {
      if (animStartRef.current === null) animStartRef.current = ts;
      const p = Math.min(1, (ts - animStartRef.current) / ANIM_DURATION);
      setAnimProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cashflowData.nodes.length]);

  // Build d3-sankey layout — constrain vertical extent to avoid giant bars
  const { layoutNodes, layoutLinks } = (() => {
    if (cashflowData.nodes.length === 0 || cashflowData.links.length === 0) {
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }

    const nodeIdSet = new Set(cashflowData.nodes.map((n) => n.id));
    const d3Nodes = cashflowData.nodes.map((n) => ({ ...n }));
    const d3Links = cashflowData.links
      .filter((l) => nodeIdSet.has(l.source) && nodeIdSet.has(l.target))
      .map((l) => ({ ...l, source: l.source, target: l.target, value: l.value }));

    if (d3Links.length === 0) {
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }

    try {
      // Cap the layout height so the diagram doesn't fill the entire viewport vertically
      const maxLayoutHeight = Math.min(size.height - MARGIN.top - MARGIN.bottom, 420);
      const yOffset = MARGIN.top + (size.height - MARGIN.top - MARGIN.bottom - maxLayoutHeight) / 2;

      const generator = d3Sankey<SankeyNode, SankeyLink>()
        .nodeId((d: any) => d.id)
        .nodeWidth(NODE_WIDTH)
        .nodePadding(NODE_PAD)
        .nodeAlign((node: any) => node.column ?? 0)
        .extent([
          [MARGIN.left, yOffset],
          [size.width - MARGIN.right, yOffset + maxLayoutHeight],
        ]);

      const { nodes: ln, links: ll } = generator({
        nodes: d3Nodes as any,
        links: d3Links as any,
      });

      return { layoutNodes: ln as LayoutNode[], layoutLinks: ll as LayoutLink[] };
    } catch (e) {
      console.error('Cashflow layout error:', e);
      return { layoutNodes: [] as LayoutNode[], layoutLinks: [] as LayoutLink[] };
    }
  })();

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
        content: `${sn.label}: ${formatAUD(sn.value)}/yr`,
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
        content: `${src.label} → ${tgt.label}: ${formatAUD(link.value)}/yr`,
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

  if (cashflowData.nodes.length === 0) {
    return (
      <div ref={mapRef} className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1a1a2e]' : 'bg-slate-100'}`}>
        <div ref={containerRef} className="w-full h-full flex items-center justify-center">
          <p className={`text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
            No cashflow data to display
          </p>
        </div>
      </div>
    );
  }

  const surplusColor = cashflowData.surplus >= 0 ? 'text-emerald-400' : 'text-red-400';

  // Animation phases: nodes 0→0.5, links 0.4→1.0
  const nodeAnimFactor = Math.min(1, animProgress / 0.5);
  const linkAnimFactor = Math.max(0, (animProgress - 0.4) / 0.6);

  return (
    <div ref={mapRef} className={`w-full h-full ${isDark ? 'bg-[#1a1a2e]' : 'bg-slate-100'}`}>
      <div ref={containerRef} className="w-full h-full relative flex flex-col">
        <svg
          width={size.width}
          height={size.height}
          className="flex-1 min-h-0 w-full"
          onMouseMove={handleMouseMove}
        >
          {/* SVG defs for glow filters */}
          <defs>
            {layoutNodes.map((node) => {
              const sn = node as any;
              return (
                <filter key={`glow-${sn.id}`} id={`glow-${sn.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                  <feFlood floodColor={sn.color} floodOpacity="0.4" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              );
            })}
          </defs>

          {/* Column headers */}
          {columnXPositions.map(({ col, x }) => x > 0 && COLUMN_LABELS[col] && (
            <text
              key={col}
              x={x}
              y={24}
              textAnchor="middle"
              style={{
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '2px',
                opacity: Math.min(1, animProgress * 3) * (isDark ? 0.35 : 0.4),
              }}
              fill={isDark ? '#94a3b8' : '#64748b'}
            >
              {COLUMN_LABELS[col]}
            </text>
          ))}

          {/* Links — filled bezier shapes */}
          <g>
            {layoutLinks.map((link, i) => {
              const src = link.source as any;
              const tgt = link.target as any;
              const srcId = src.id as string;
              const tgtId = tgt.id as string;
              const isConnected = connectedNodeIds.has(srcId) && connectedNodeIds.has(tgtId);
              const dimmed = isHighlighting && !isConnected;
              const isThisLink = hoveredLink && hoveredLink.source === srcId && hoveredLink.target === tgtId;

              // Staggered link animation
              const linkDelay = i * 0.06;
              const linkP = Math.max(0, Math.min(1, (linkAnimFactor - linkDelay) * 2.5));

              const baseOpacity = dimmed ? 0.05 : isThisLink ? 0.65 : (isDark ? 0.35 : 0.45);
              const opacity = baseOpacity * linkP;

              const color = tgt.id === 'household' ? (src.color || '#3b82f6') : (tgt.color || '#64748b');

              return (
                <path
                  key={i}
                  d={linkFillPath(link)}
                  fill={color}
                  fillOpacity={opacity}
                  onMouseEnter={(e) => handleLinkEnter(e, link)}
                  onMouseLeave={handleMouseLeave}
                  className="cursor-pointer"
                />
              );
            })}
          </g>

          {/* Nodes */}
          {layoutNodes.map((node, i) => {
            const sn = node as any;
            const x0 = node.x0 ?? 0;
            const y0 = node.y0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y1 = node.y1 ?? 0;
            const w = x1 - x0;
            const h = y1 - y0;
            const dimmed = isHighlighting && !connectedNodeIds.has(sn.id);
            const isHousehold = sn.id === 'household';

            // Staggered node animation
            const nodeDelay = i * 0.08;
            const nodeP = Math.max(0, Math.min(1, (nodeAnimFactor - nodeDelay) * 2));
            const barH = h * nodeP;
            const barY = y0 + (h - barH) / 2;

            // Household label: above; col 0: left; col 2: right
            const labelX = isHousehold ? x0 + w / 2 : sn.column === 0 ? x0 - 12 : x1 + 12;
            const labelAnchor = isHousehold ? 'middle' as const : sn.column === 0 ? 'end' as const : 'start' as const;
            const labelY = isHousehold ? y0 - 20 : y0 + h / 2;
            const valueY = isHousehold ? y0 - 6 : y0 + h / 2 + 14;

            const nodeOpacity = dimmed ? 0.15 : 0.9;
            const textOpacity = nodeP * (isDark
              ? (dimmed ? 0.1 : 0.8)
              : (dimmed ? 0.1 : 0.85));
            const valueTextOpacity = nodeP * (isDark ? 0.45 : 0.5);

            return (
              <g
                key={sn.id}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <rect
                  x={x0}
                  y={barY}
                  width={w}
                  height={barH}
                  fill={sn.color}
                  rx={4}
                  opacity={nodeOpacity * nodeP}
                  filter={!dimmed && isDark ? `url(#glow-${sn.id})` : undefined}
                />
                <text
                  x={labelX}
                  y={labelY}
                  dy={isHousehold ? '0em' : '0.35em'}
                  textAnchor={labelAnchor}
                  style={{ fontSize: '11px', fontWeight: 600 }}
                  fill={isDark ? '#e2e8f0' : '#1e293b'}
                  opacity={textOpacity}
                >
                  {sn.label}
                </text>
                {!dimmed && nodeP > 0.3 && (
                  <text
                    x={labelX}
                    y={valueY}
                    dy={isHousehold ? '0em' : '0.35em'}
                    textAnchor={labelAnchor}
                    style={{ fontSize: '10px', fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}
                    fill={isDark ? '#94a3b8' : '#64748b'}
                    opacity={valueTextOpacity}
                  >
                    {formatAUD(sn.value)}/yr
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Summary strip — bottom */}
        <div
          className={`shrink-0 flex items-center justify-center gap-8 py-3 border-t text-sm
            ${isDark ? 'border-white/10' : 'border-gray-200'}`}
          style={{ opacity: Math.min(1, animProgress * 3) }}
        >
          <div className="text-center">
            <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Total Income</span>
            <span className={`ml-2 font-semibold ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
              {formatAUD(cashflowData.totalIncome)}/yr
            </span>
          </div>
          <div className={`w-px h-5 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
          <div className="text-center">
            <span className={isDark ? 'text-white/40' : 'text-gray-400'}>Total Outflows</span>
            <span className={`ml-2 font-semibold ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
              {formatAUD(cashflowData.totalOutflows)}/yr
            </span>
          </div>
          <div className={`w-px h-5 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
          <div className="text-center">
            <span className={isDark ? 'text-white/40' : 'text-gray-400'}>
              {cashflowData.surplus >= 0 ? 'Surplus' : 'Deficit'}
            </span>
            <span className={`ml-2 font-semibold ${surplusColor}`}>
              {formatAUD(Math.abs(cashflowData.surplus))}/yr
            </span>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className={`absolute pointer-events-none px-3 py-2 rounded-lg text-xs shadow-xl whitespace-nowrap backdrop-blur-sm
              ${isDark
                ? 'bg-[#1a1a2e]/95 border border-white/10 text-white/90'
                : 'bg-white/95 border border-gray-200 text-gray-900'
              }`}
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <div className="font-semibold">{tooltip.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}
