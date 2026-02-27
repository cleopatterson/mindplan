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
import { getPickerOptions, type PickerOption, type ChildNodeType } from '../../utils/nodeChildTypes';
import { NodeTypePicker } from './NodeTypePicker';
import '@xyflow/react/dist/style.css';
import type { FinancialPlan } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
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
import { GoalsGroupNode } from './nodes/GoalsGroupNode';
import { GoalNode } from './nodes/GoalNode';
import { RelationshipsGroupNode } from './nodes/RelationshipsGroupNode';
import { RelationshipNode } from './nodes/RelationshipNode';
import { AssetGroupNode } from './nodes/AssetGroupNode';

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
  goalsGroupNode: GoalsGroupNode,
  goalNode: GoalNode,
  relationshipsGroupNode: RelationshipsGroupNode,
  relationshipNode: RelationshipNode,
  assetGroupNode: AssetGroupNode,
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
  onCreateChildNode: (parentNodeId: string, childType: ChildNodeType, overrides?: Record<string, unknown>) => string;
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

const CROSS_LINK_STYLE: React.CSSProperties = {
  stroke: 'rgba(96,165,250,0.35)',
  strokeWidth: 1.5,
  strokeDasharray: '4 3',
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
  { data, selectedNodeIds, onSelectNode, highlightedNodeIds, hoveredNodeIds, userLinks, onAddLink, onRemoveLink, onCreateChildNode },
  ref,
) {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const { fitView, getNodes, setCenter, getViewport, setViewport } = useReactFlow();
  const edgeStyle = useMemo<React.CSSProperties>(() => ({
    stroke: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
    strokeWidth: 2,
  }), [isDark]);

  const edgeOptions = useMemo(() => ({
    type: 'smoothstep' as const,
    style: edgeStyle,
  }), [edgeStyle]);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    const t0 = performance.now();
    const result = transformToGraph(data);
    console.log(`⏱ [mindmap] transformToGraph: ${(performance.now() - t0).toFixed(1)}ms (${result.nodes.length} nodes, ${result.edges.length} edges)`);
    return result;
  }, [data]);

  // Collapsible asset groups — all collapsed by default
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  // Reset collapsed state when data changes (new upload)
  const dataRef = useRef(data);
  useEffect(() => {
    if (data !== dataRef.current) {
      dataRef.current = data;
      setExpandedGroupIds(new Set());
    }
  }, [data]);

  // Filter out children of collapsed groups + stamp isExpanded on group nodes
  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(() => {
    // Collect all assetGroup node IDs
    const groupNodeIds = new Set<string>();
    for (const node of rawNodes) {
      if (node.data.nodeType === 'assetGroup') groupNodeIds.add(node.id);
    }

    // Find children of collapsed groups (edges from collapsed group → child)
    const hiddenNodeIds = new Set<string>();
    for (const edge of rawEdges) {
      if (groupNodeIds.has(edge.source) && !expandedGroupIds.has(edge.source)) {
        hiddenNodeIds.add(edge.target);
      }
    }

    // Filter nodes: hide children, stamp isExpanded on groups
    const filteredNodes = rawNodes
      .filter((n) => !hiddenNodeIds.has(n.id))
      .map((n) => {
        if (n.data.nodeType === 'assetGroup') {
          return { ...n, data: { ...n.data, isExpanded: expandedGroupIds.has(n.id) } };
        }
        return n;
      });

    // Filter edges: hide edges to/from hidden nodes
    const filteredEdges = rawEdges.filter(
      (e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target),
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [rawNodes, rawEdges, expandedGroupIds]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(visibleNodes, visibleEdges);

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

  // Viewport anchor — stabilize position when expanding/collapsing groups
  const pendingAnchorRef = useRef<{
    nodeId: string;
    oldPos: { x: number; y: number };
    viewport: { x: number; y: number; zoom: number };
  } | null>(null);

  // --- Drag-to-create-child state ---
  const connectSourceRef = useRef<string | null>(null);
  const connectDidCompleteRef = useRef(false);
  const pendingSelectRef = useRef<string | null>(null);
  const [pickerState, setPickerState] = useState<{
    x: number; y: number; parentId: string; options: PickerOption[]; parentNodeType: string; sourceGroupId?: string;
  } | null>(null);

  useEffect(() => {
    setNodes(layoutedNodes);

    // Compensate viewport so the toggled group node stays in the same screen position
    const anchor = pendingAnchorRef.current;
    if (anchor) {
      pendingAnchorRef.current = null;
      const newNode = layoutedNodes.find((n) => n.id === anchor.nodeId);
      if (newNode) {
        const dx = newNode.position.x - anchor.oldPos.x;
        const dy = newNode.position.y - anchor.oldPos.y;
        if (dx !== 0 || dy !== 0) {
          const { zoom } = anchor.viewport;
          setViewport({
            x: anchor.viewport.x - dx * zoom,
            y: anchor.viewport.y - dy * zoom,
            zoom,
          });
        }
      }
    }
  }, [layoutedNodes, setViewport]);
  useEffect(() => { setEdges(allEdges); }, [allEdges]);

  // Auto-select a newly created node once it appears in the layout
  useEffect(() => {
    if (pendingSelectRef.current) {
      const nodeId = pendingSelectRef.current;
      if (layoutedNodes.some((n) => n.id === nodeId)) {
        onSelectNode(nodeId, false);
      }
      pendingSelectRef.current = null;
    }
  }, [layoutedNodes, onSelectNode]);

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
        const isCrossLink = !!edge.data?.isCrossLink;
        const isDashed = isLink || isCrossLink;
        const connected = (hasSummaryHighlight || hasHover)
          ? activeIds.has(edge.source) || activeIds.has(edge.target)
          : hasBranchHighlight
            ? activeIds.has(edge.source) && activeIds.has(edge.target)
            : false;
        // When no highlight is active, restore original style
        const baseStyle = isLink ? LINK_STYLE : isCrossLink ? CROSS_LINK_STYLE : edgeStyle;
        const dimmedStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
        return {
          ...edge,
          style: {
            ...(hasAnyHighlight
              ? {
                  stroke: connected
                    ? (isPreview ? 'rgba(96,165,250,0.35)' : 'rgba(96,165,250,0.6)')
                    : dimmedStroke,
                  strokeWidth: connected ? 2.5 : 2,
                  ...(isDashed ? { strokeDasharray: isLink ? '6 4' : '4 3' } : {}),
                }
              : baseStyle),
            transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
          },
          animated: hasAnyHighlight && connected && !isPreview,
        };
      });
    });
  }, [highlightedNodeIds, hoveredNodeIds, selectedBranchIds, isDark, edgeStyle]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Filter out selection changes — we manage selection ourselves via onNodeClick
      const filtered = changes.filter((c) => c.type !== 'select');
      if (filtered.length > 0) {
        setNodes((nds) => applyNodeChanges(filtered, nds) as Node<NodeData>[]);
      }
    },
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null, false);
  }, [onSelectNode]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Asset group nodes toggle expand/collapse instead of selecting
      if ((node.data as NodeData).nodeType === 'assetGroup') {
        // Capture the node's current position + viewport so we can anchor after re-layout
        pendingAnchorRef.current = {
          nodeId: node.id,
          oldPos: { x: node.position.x, y: node.position.y },
          viewport: getViewport(),
        };
        setExpandedGroupIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
        return;
      }
      const isAdditive = event.shiftKey;
      if (!isAdditive && selectedNodeIds.has(node.id) && selectedNodeIds.size === 1) {
        // Clicking the only selected node deselects it
        onSelectNode(null, false);
      } else {
        onSelectNode(node.id, isAdditive);
      }
    },
    [onSelectNode, selectedNodeIds, getViewport],
  );

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null }) => {
      connectSourceRef.current = params.nodeId;
      connectDidCompleteRef.current = false;
    },
    [],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      connectDidCompleteRef.current = true;
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

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (connectDidCompleteRef.current || !connectSourceRef.current) return;

      // Don't create child if dropped on an existing node
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node')) return;

      const sourceId = connectSourceRef.current;
      const sourceNode = getNodes().find((n) => n.id === sourceId);
      if (!sourceNode?.data) return;

      const nodeData = sourceNode.data as NodeData;
      const nodeType = nodeData.nodeType;
      const options = getPickerOptions(nodeType);
      if (!options) return;

      // For assetGroup nodes, resolve to the actual owner (client/entity) for addNode
      const resolvedParentId = nodeType === 'assetGroup' && nodeData.parentOwnerId
        ? nodeData.parentOwnerId
        : sourceId;

      // Track source group so we can auto-expand it after creating a child
      const sourceGroupId = nodeType === 'assetGroup' ? sourceId : undefined;

      const clientX = 'changedTouches' in event ? (event as TouchEvent).changedTouches[0].clientX : (event as MouseEvent).clientX;
      const clientY = 'changedTouches' in event ? (event as TouchEvent).changedTouches[0].clientY : (event as MouseEvent).clientY;

      setPickerState({ x: clientX, y: clientY, parentId: resolvedParentId, options, parentNodeType: nodeType, sourceGroupId });
    },
    [getNodes],
  );

  const handlePickerSelect = useCallback(
    (option: PickerOption) => {
      if (!pickerState) return;
      // Auto-expand the source group so the new child is visible
      if (pickerState.sourceGroupId) {
        setExpandedGroupIds((prev) => {
          const next = new Set(prev);
          next.add(pickerState.sourceGroupId!);
          return next;
        });
      }
      const newId = onCreateChildNode(pickerState.parentId, option.childType, option.overrides);
      pendingSelectRef.current = newId;
      setPickerState(null);
    },
    [pickerState, onCreateChildNode],
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
        onPaneClick={onPaneClick}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        defaultEdgeOptions={edgeOptions}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode={isDark ? 'dark' : 'light'}
      >
        <Background color={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'} gap={20} />
        <Controls />
        <MiniMap
          style={{ background: isDark ? '#1e1e2e' : '#f8fafc' }}
          maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)'}
          nodeColor={(node) => {
            const type = node.data?.nodeType;
            if (type === 'family') return '#ffffff';
            if (type === 'client') return '#3b82f6';
            if (type === 'entity') return '#22c55e';
            if (type === 'liability') return '#ef4444';
            if (type === 'estateGroup' || type === 'estateClient' || type === 'estateItem') return '#6366f1';
            if (type === 'familyGroup' || type === 'familyMember') return '#f59e0b';
            if (type === 'goalsGroup' || type === 'goal') return '#14b8a6';
            if (type === 'relationshipsGroup' || type === 'relationship') return '#f43f5e';
            if (type === 'assetGroup') return '#64748b';
            return '#6b7280';
          }}
        />
      </ReactFlow>
      {pickerState && (
        <NodeTypePicker
          x={pickerState.x}
          y={pickerState.y}
          options={pickerState.options}
          parentNodeType={pickerState.parentNodeType}
          onPick={handlePickerSelect}
          onClose={() => setPickerState(null)}
        />
      )}
    </div>
  );
});
