import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../utils/transformToGraph';

const NODE_WIDTH: Record<NodeData['nodeType'], number> = {
  client: 220,
  entity: 200,
  asset: 180,
  liability: 180,
};

const NODE_HEIGHT: Record<NodeData['nodeType'], number> = {
  client: 80,
  entity: 70,
  asset: 60,
  liability: 60,
};

export function useGraphLayout(nodes: Node<NodeData>[], edges: Edge[]) {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

    for (const node of nodes) {
      const type = node.data.nodeType;
      g.setNode(node.id, { width: NODE_WIDTH[type], height: NODE_HEIGHT[type] });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
      const pos = g.node(node.id);
      const type = node.data.nodeType;
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH[type] / 2,
          y: pos.y - NODE_HEIGHT[type] / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }, [nodes, edges]);
}
