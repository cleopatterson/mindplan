import { useMemo, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeTypes,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
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

const nodeTypes: NodeTypes = {
  familyNode: FamilyNode,
  clientNode: ClientNode,
  entityNode: EntityNode,
  assetNode: AssetNode,
  liabilityNode: LiabilityNode,
};

interface MindMapProps {
  data: FinancialPlan;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  highlightedNodeIds: Set<string>;
}

export interface MindMapHandle {
  fitView: (opts?: { padding?: number }) => void;
  getContentBounds: () => { width: number; height: number };
}

export const MindMap = forwardRef<MindMapHandle, MindMapProps>(function MindMap(props, ref) {
  return (
    <ReactFlowProvider>
      <MindMapInner ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

const MindMapInner = forwardRef<MindMapHandle, MindMapProps>(function MindMapInner(
  { data, selectedNodeId, onSelectNode, highlightedNodeIds },
  ref,
) {
  const { fitView, getNodes } = useReactFlow();
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => transformToGraph(data), [data]);
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);

  const [nodes, setNodes] = useState<Node<NodeData>[]>(layoutedNodes);
  const [edges, setEdges] = useState<Edge[]>(layoutedEdges);

  useImperativeHandle(ref, () => ({
    fitView: (opts) => fitView({ padding: opts?.padding ?? 0.03, duration: 0 }),
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
  }), [fitView, getNodes]);

  useEffect(() => { setNodes(layoutedNodes); }, [layoutedNodes]);
  useEffect(() => { setEdges(layoutedEdges); }, [layoutedEdges]);

  // Compute the branch node IDs for a selected node (ancestors + descendants)
  const selectedBranchIds = useMemo(() => {
    if (!selectedNodeId || highlightedNodeIds.size > 0) return new Set<string>();
    const ids = new Set<string>([selectedNodeId]);
    let current = selectedNodeId;
    for (let i = 0; i < 10; i++) {
      const parentEdge = layoutedEdges.find((e) => e.target === current);
      if (!parentEdge) break;
      ids.add(parentEdge.source);
      current = parentEdge.source;
    }
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const edge of layoutedEdges) {
        if (edge.source === node && !ids.has(edge.target)) {
          ids.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    return ids;
  }, [selectedNodeId, highlightedNodeIds, layoutedEdges]);

  // Apply highlight dimming to nodes AND edges
  useEffect(() => {
    const hasSummaryHighlight = highlightedNodeIds.size > 0;
    const hasBranchHighlight = selectedBranchIds.size > 0;
    const hasAnyHighlight = hasSummaryHighlight || hasBranchHighlight;
    const activeIds = hasSummaryHighlight ? highlightedNodeIds : selectedBranchIds;

    setNodes((prev) => {
      // Skip creating new objects when nothing is highlighted and nothing was highlighted before
      const wasHighlighted = prev.some((n) => n.style?.opacity !== undefined && n.style.opacity !== 1);
      if (!hasAnyHighlight && !wasHighlighted) return prev;

      return prev.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity:
            hasAnyHighlight && !activeIds.has(node.id) && node.data.nodeType !== 'family'
              ? 0.15
              : 1,
          transition: 'opacity 0.3s ease',
        },
      }));
    });
    setEdges((prev) => {
      const wasStyled = prev.some((e) => e.animated);
      if (!hasAnyHighlight && !wasStyled) return prev;

      return prev.map((edge) => {
        const connected = hasSummaryHighlight
          ? highlightedNodeIds.has(edge.source) || highlightedNodeIds.has(edge.target)
          : hasBranchHighlight
            ? activeIds.has(edge.source) && activeIds.has(edge.target)
            : false;
        return {
          ...edge,
          style: {
            stroke: hasAnyHighlight && connected
              ? 'rgba(96,165,250,0.6)'
              : hasAnyHighlight
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(255,255,255,0.25)',
            strokeWidth: hasAnyHighlight && connected ? 2.5 : 2,
            transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease',
          },
          animated: hasAnyHighlight && connected,
        };
      });
    });
  }, [highlightedNodeIds, selectedBranchIds]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[]),
    [],
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, selectedNodeId],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: 'rgba(255,255,255,0.25)', strokeWidth: 2 },
        }}
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
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
});
