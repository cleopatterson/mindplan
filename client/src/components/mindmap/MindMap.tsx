import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FinancialPlan } from 'shared/types';
import { transformToGraph } from '../../utils/transformToGraph';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { ClientNode } from './nodes/ClientNode';
import { EntityNode } from './nodes/EntityNode';
import { AssetNode } from './nodes/AssetNode';
import { LiabilityNode } from './nodes/LiabilityNode';

const nodeTypes: NodeTypes = {
  clientNode: ClientNode,
  entityNode: EntityNode,
  assetNode: AssetNode,
  liabilityNode: LiabilityNode,
};

interface MindMapProps {
  data: FinancialPlan;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export function MindMap({ data, selectedNodeId, onSelectNode }: MindMapProps) {
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => transformToGraph(data), [data]);
  const { nodes: layoutedNodes, edges: layoutedEdges } = useGraphLayout(rawNodes, rawEdges);

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onSelectNode(node.id === selectedNodeId ? null : node.id);
    },
    [onSelectNode, selectedNodeId],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
    >
      <Background />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          const type = node.data?.nodeType;
          if (type === 'client') return '#3b82f6';
          if (type === 'entity') return '#22c55e';
          if (type === 'liability') return '#ef4444';
          return '#9ca3af';
        }}
      />
    </ReactFlow>
  );
}
