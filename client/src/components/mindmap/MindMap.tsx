import { useMemo, useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FinancialPlan } from 'shared/types';
import { transformToGraph, type NodeData } from '../../utils/transformToGraph';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { FamilyNode } from './nodes/FamilyNode';
import { ClientNode } from './nodes/ClientNode';
import { EntityNode } from './nodes/EntityNode';
import { AssetNode } from './nodes/AssetNode';
import { LiabilityNode } from './nodes/LiabilityNode';
import { EstateGroupNode } from './nodes/EstateGroupNode';
import { EstateClientNode } from './nodes/EstateClientNode';
import { EstateItemNode } from './nodes/EstateItemNode';
import { FamilyGroupNode } from './nodes/FamilyGroupNode';
import { FamilyMemberNode } from './nodes/FamilyMemberNode';

const nodeTypes: NodeTypes = {
  familyNode: FamilyNode,
  clientNode: ClientNode,
  entityNode: EntityNode,
  assetNode: AssetNode,
  liabilityNode: LiabilityNode,
  estateGroupNode: EstateGroupNode,
  estateClientNode: EstateClientNode,
  estateItemNode: EstateItemNode,
  familyGroupNode: FamilyGroupNode,
  familyMemberNode: FamilyMemberNode,
};

interface MindMapProps {
  data: FinancialPlan;
  selectedNodeIds: Set<string>;
  onSelectNode: (id: string | null, additive: boolean) => void;
  highlightedNodeIds: Set<string>;
  hoveredNodeIds: Set<string>;
  userLinks: Edge[];
  onAddLink: (edge: Edge) => void;
  onRemoveLink: (edgeId: string) => void;
}

export interface MindMapHandle {
  fitView: (opts?: { padding?: number }) => void;
  focusNode: (nodeId: string) => void;
  getContentBounds: () => { width: number; height: number };
}

export const MindMap = forwardRef<MindMapHandle, MindMapProps>(function MindMap(props, ref) {
  return (
    <ReactFlowProvider>
      <MindMapInner ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

const LINK_STYLE: React.CSSProperties = {
  stroke: 'rgba(168,85,247,0.45)',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
};

const DEFAULT_EDGE_STYLE: React.CSSProperties = {
  stroke: 'rgba(255,255,255,0.25)',
  strokeWidth: 2,
};

const CONNECTION_LINE_STYLE: React.CSSProperties = {
  stroke: 'rgba(168,85,247,0.5)',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
};

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  style: DEFAULT_EDGE_STYLE,
};

const MindMapInner = forwardRef<MindMapHandle, MindMapProps>(function MindMapInner(
  { data, selectedNodeIds, onSelectNode, highlightedNodeIds, hoveredNodeIds, userLinks, onAddLink, onRemoveLink },
  ref,
) {
  const { fitView, getNodes, setCenter } = useReactFlow();
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const t0 = performance.now();
    const result = transformToGraph(data);
    console.log(`⏱ [mindmap] transformToGraph: ${(performance.now() - t0).toFixed(1)}ms (${result.nodes.length} nodes, ${result.edges.length} edges)`);
    return result;
  }, [data]);
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);

  // Merge structural edges with user-drawn cross-links
  const allEdges = useMemo(() => [...layoutedEdges, ...userLinks], [layoutedEdges, userLinks]);

  const [nodes, setNodes] = useState<Node<NodeData>[]>(layoutedNodes);
  const [edges, setEdges] = useState<Edge[]>(allEdges);

  useImperativeHandle(ref, () => ({
    fitView: (opts) => fitView({ padding: opts?.padding ?? 0.03, duration: 0 }),
    focusNode: (nodeId: string) => {
      const node = getNodes().find((n) => n.id === nodeId);
      if (!node) return;
      const x = node.position.x + (node.measured?.width ?? 200) / 2;
      const y = node.position.y + (node.measured?.height ?? 50) / 2;
      setCenter(x, y, { zoom: 1.5, duration: 400 });
    },
    getContentBounds: () => {
      const allNodes = getNodes();
      if (allNodes.length === 0) return { width: 800, height: 600 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of allNodes) {
        const w = node.measured?.width ?? 200;
        const h = node.measured?.height ?? 60;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + w);
        maxY = Math.max(maxY, node.position.y + h);
      }
      return { width: maxX - minX, height: maxY - minY };
    },
  }), [fitView, setCenter, getNodes]);

  useEffect(() => { setNodes(layoutedNodes); }, [layoutedNodes]);
  useEffect(() => { setEdges(allEdges); }, [allEdges]);

  // Log once per data change when layout is first applied (marks the end of the pipeline)
  const didLogMount = useRef(false);
  useEffect(() => { didLogMount.current = false; }, [data]);
  useEffect(() => {
    if (!didLogMount.current && layoutedNodes.length > 0) {
      didLogMount.current = true;
      console.timeEnd('⏱ [client] Total upload→render');
    }
  }, [layoutedNodes]);

  // Pre-build adjacency maps once — O(E), stable between data changes
  const { parentOf, childrenOf } = useMemo(() => {
    const parentOf = new Map<string, string>();
    const childrenOf = new Map<string, string[]>();
    for (const e of layoutedEdges) {
      if (!e.data?.isUserLink) {
        parentOf.set(e.target, e.source);
        const children = childrenOf.get(e.source);
        if (children) children.push(e.target);
        else childrenOf.set(e.source, [e.target]);
      }
    }
    return { parentOf, childrenOf };
  }, [layoutedEdges]);

  // Compute the branch node IDs for all selected nodes — O(N) with adjacency maps
  const selectedBranchIds = useMemo(() => {
    if (selectedNodeIds.size === 0 || highlightedNodeIds.size > 0) return new Set<string>();
    const ids = new Set<string>();
    for (const nodeId of selectedNodeIds) {
      ids.add(nodeId);
      // Walk up to ancestors via O(1) map lookups
      let current: string | undefined = nodeId;
      while ((current = parentOf.get(current!))) ids.add(current);
      // Walk down to descendants via O(1) map lookups
      const queue = [nodeId];
      while (queue.length > 0) {
        const n = queue.shift()!;
        for (const child of childrenOf.get(n) ?? []) {
          if (!ids.has(child)) { ids.add(child); queue.push(child); }
        }
      }
    }
    return ids;
  }, [selectedNodeIds, highlightedNodeIds, parentOf, childrenOf]);

  // Track the previous active highlight set to skip identical updates
  const prevActiveRef = useRef<{ ids: Set<string>; isPreview: boolean }>({ ids: new Set(), isPreview: false });

  // Apply highlight dimming to nodes AND edges
  // Priority: clicked highlight > hovered preview > branch selection > default
  useEffect(() => {
    const hasSummaryHighlight = highlightedNodeIds.size > 0;
    const hasHover = hoveredNodeIds.size > 0;
    const hasBranchHighlight = selectedBranchIds.size > 0;
    const hasAnyHighlight = hasSummaryHighlight || hasHover || hasBranchHighlight;
    const activeIds = hasSummaryHighlight ? highlightedNodeIds : hasHover ? hoveredNodeIds : selectedBranchIds;
    const isPreview = !hasSummaryHighlight && hasHover; // lighter effect for hover

    // Skip if the active set content and mode haven't changed
    const prev = prevActiveRef.current;
    if (
      activeIds.size === prev.ids.size &&
      isPreview === prev.isPreview &&
      (activeIds.size === 0 || [...activeIds].every((id) => prev.ids.has(id)))
    ) {
      return;
    }
    prevActiveRef.current = { ids: activeIds, isPreview };

    setNodes((prevNodes) => {
      const wasHighlighted = prevNodes.some((n) => n.style?.opacity !== undefined && n.style.opacity !== 1);
      if (!hasAnyHighlight && !wasHighlighted) return prevNodes;

      return prevNodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity:
            hasAnyHighlight && !activeIds.has(node.id) && node.data.nodeType !== 'family'
              ? (isPreview ? 0.35 : 0.15)
              : 1,
          transition: 'opacity 0.2s ease',
        },
      }));
    });
    setEdges((prevEdges) => {
      const wasStyled = prevEdges.some((e) => e.animated);
      if (!hasAnyHighlight && !wasStyled) return prevEdges;

      return prevEdges.map((edge) => {
        const isLink = !!edge.data?.isUserLink;
        const connected = (hasSummaryHighlight || hasHover)
          ? activeIds.has(edge.source) || activeIds.has(edge.target)
          : hasBranchHighlight
            ? activeIds.has(edge.source) && activeIds.has(edge.target)
            : false;
        // When no highlight is active, restore original style (cross-links keep dashed purple)
        const baseStyle = isLink ? LINK_STYLE : DEFAULT_EDGE_STYLE;
        return {
          ...edge,
          style: {
            ...(hasAnyHighlight
              ? {
                  stroke: connected
                    ? (isPreview ? 'rgba(96,165,250,0.35)' : 'rgba(96,165,250,0.6)')
                    : 'rgba(255,255,255,0.06)',
                  strokeWidth: connected ? 2.5 : 2,
                  ...(isLink ? { strokeDasharray: '6 4' } : {}),
                }
              : baseStyle),
            transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
          },
          animated: hasAnyHighlight && connected && !isPreview,
        };
      });
    });
  }, [highlightedNodeIds, hoveredNodeIds, selectedBranchIds]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[]),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      const isAdditive = event.shiftKey;
      if (!isAdditive && selectedNodeIds.has(node.id) && selectedNodeIds.size === 1) {
        // Clicking the only selected node deselects it
        onSelectNode(null, false);
      } else {
        onSelectNode(node.id, isAdditive);
      }
    },
    [onSelectNode, selectedNodeIds],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target || params.source === params.target) return;
      // Don't duplicate existing edges (structural or user)
      const exists = edges.some(
        (e) =>
          (e.source === params.source && e.target === params.target) ||
          (e.source === params.target && e.target === params.source),
      );
      if (exists) return;

      const newEdge: Edge = {
        id: `link-${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        type: 'smoothstep',
        style: LINK_STYLE,
        data: { isUserLink: true },
      };
      onAddLink(newEdge);
    },
    [edges, onAddLink],
  );

  // Double-click edge to remove user links
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.isUserLink) {
        onRemoveLink(edge.id);
      }
    },
    [onRemoveLink],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="rgba(255,255,255,0.03)" gap={20} />
        <Controls />
        <MiniMap
          style={{ background: '#1e1e2e' }}
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={(node) => {
            const type = node.data?.nodeType;
            if (type === 'family') return '#ffffff';
            if (type === 'client') return '#3b82f6';
            if (type === 'entity') return '#22c55e';
            if (type === 'liability') return '#ef4444';
            if (type === 'estateGroup' || type === 'estateClient' || type === 'estateItem') return '#6366f1';
            if (type === 'familyGroup' || type === 'familyMember') return '#f59e0b';
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
});
