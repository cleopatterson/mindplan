import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../utils/transformToGraph';

const NODE_WIDTH: Record<NodeData['nodeType'], number> = {
  family: 200,
  client: 200,
  entity: 200,
  asset: 180,
  liability: 180,
};

const NODE_HEIGHT: Record<NodeData['nodeType'], number> = {
  family: 60,
  client: 60,
  entity: 56,
  asset: 50,
  liability: 50,
};

/**
 * Runs dagre twice — LR for the right side, RL for the left side —
 * then stitches both halves around the central family node.
 */
export function useGraphLayout(nodes: Node<NodeData>[], edges: Edge[]) {
  return useMemo(() => {
    const familyNode = nodes.find((n) => n.data.nodeType === 'family');
    if (!familyNode) return { nodes, edges };

    const leftNodes = nodes.filter((n) => n.data.side === 'left');
    const rightNodes = nodes.filter((n) => n.data.side === 'right');

    const leftIds = new Set(leftNodes.map((n) => n.id));
    const rightIds = new Set(rightNodes.map((n) => n.id));

    // Edges for each side (include family node in both)
    const leftEdges = edges.filter(
      (e) =>
        (leftIds.has(e.source) || e.source === familyNode.id) &&
        (leftIds.has(e.target) || e.target === familyNode.id),
    );
    const rightEdges = edges.filter(
      (e) =>
        (rightIds.has(e.source) || e.source === familyNode.id) &&
        (rightIds.has(e.target) || e.target === familyNode.id),
    );

    // Layout right side (LR — family on the left, entities flow right)
    const rightPositions = runDagre(
      [familyNode, ...rightNodes],
      rightEdges,
      'LR',
    );

    // Layout left side (RL — family on the right, clients flow left)
    const leftPositions = runDagre(
      [familyNode, ...leftNodes],
      leftEdges,
      'RL',
    );

    // Family node sits at origin; offset each side relative to it
    const familyRight = rightPositions.get(familyNode.id);
    const familyLeft = leftPositions.get(familyNode.id);

    const positioned = nodes.map((node) => {
      const w = NODE_WIDTH[node.data.nodeType];
      const h = NODE_HEIGHT[node.data.nodeType];

      if (node.id === familyNode.id) {
        return { ...node, position: { x: -w / 2, y: -h / 2 } };
      }

      if (node.data.side === 'right' && familyRight) {
        const pos = rightPositions.get(node.id);
        if (pos) {
          return {
            ...node,
            position: {
              x: pos.x - familyRight.x - w / 2,
              y: pos.y - familyRight.y - h / 2,
            },
          };
        }
      }

      if (node.data.side === 'left' && familyLeft) {
        const pos = leftPositions.get(node.id);
        if (pos) {
          return {
            ...node,
            position: {
              x: pos.x - familyLeft.x - w / 2,
              y: pos.y - familyLeft.y - h / 2,
            },
          };
        }
      }

      return node;
    });

    return { nodes: positioned, edges };
  }, [nodes, edges]);
}

function runDagre(
  nodes: Node<NodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'RL',
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep: 40, ranksep: 80 });

  for (const node of nodes) {
    const type = node.data.nodeType;
    g.setNode(node.id, { width: NODE_WIDTH[type], height: NODE_HEIGHT[type] });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    positions.set(node.id, { x: pos.x, y: pos.y });
  }

  return positions;
}
