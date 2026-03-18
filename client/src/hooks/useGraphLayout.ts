import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import { Position, type Node, type Edge } from '@xyflow/react';
import type { NodeData } from '../utils/transformToGraph';

const NODE_WIDTH: Record<NodeData['nodeType'], number> = {
  family: 200,
  client: 200,
  entity: 240,
  asset: 230,
  liability: 230,
  estateGroup: 200,
  estateClient: 200,
  estateItem: 200,
  familyGroup: 180,
  familyMember: 180,
  goalsGroup: 180,
  goalCategoryGroup: 200,
  goal: 200,
  relationshipsGroup: 180,
  relationship: 200,
  assetGroup: 200,
  expensesGroup: 200,
  expense: 230,
  insuranceGroup: 200,
  insuranceClient: 200,
  insuranceCoverGroup: 200,
  insuranceCover: 200,
};

const NODE_HEIGHT: Record<NodeData['nodeType'], number> = {
  family: 60,
  client: 60,
  entity: 56,
  asset: 50,
  liability: 50,
  estateGroup: 56,
  estateClient: 50,
  estateItem: 50,
  familyGroup: 56,
  familyMember: 50,
  goalsGroup: 56,
  goalCategoryGroup: 56,
  goal: 50,
  relationshipsGroup: 56,
  relationship: 50,
  assetGroup: 56,
  expensesGroup: 56,
  expense: 50,
  insuranceGroup: 56,
  insuranceClient: 50,
  insuranceCoverGroup: 56,
  insuranceCover: 50,
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

    // Structural edges only (exclude user links and auto cross-links from dagre)
    const structuralEdges = edges.filter((e) => !e.data?.isUserLink && !e.data?.isCrossLink);

    // Edges for each side (include family node in both)
    const leftEdges = structuralEdges.filter(
      (e) =>
        (leftIds.has(e.source) || e.source === familyNode.id) &&
        (leftIds.has(e.target) || e.target === familyNode.id),
    );
    const rightEdges = structuralEdges.filter(
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

    // Build max-width per rank so we can right-align left-side / left-align right-side
    const leftRankMaxW = rankMaxWidths(leftNodes, leftPositions);
    const rightRankMaxW = rankMaxWidths(rightNodes, rightPositions);

    // First pass: compute raw positions anchored at family node
    const rawPositioned = nodes.map((node) => {
      const w = NODE_WIDTH[node.data.nodeType];
      const h = NODE_HEIGHT[node.data.nodeType];

      if (node.id === familyNode.id) {
        return { ...node, position: { x: -w / 2, y: -h / 2 } };
      }

      if (node.data.side === 'right' && familyRight) {
        const pos = rightPositions.get(node.id);
        if (pos) {
          const maxW = rightRankMaxW.get(Math.round(pos.x)) ?? w;
          return {
            ...node,
            position: {
              x: pos.x - familyRight.x - maxW / 2,
              y: pos.y - familyRight.y - h / 2,
            },
          };
        }
      }

      if (node.data.side === 'left' && familyLeft) {
        const pos = leftPositions.get(node.id);
        if (pos) {
          const maxW = leftRankMaxW.get(Math.round(pos.x)) ?? w;
          return {
            ...node,
            position: {
              x: pos.x - familyLeft.x + maxW / 2 - w,
              y: pos.y - familyLeft.y - h / 2,
            },
          };
        }
      }

      return node;
    });

    // Second pass: align the top edges of both sides so the tree looks balanced
    let leftMinY = Infinity;
    let rightMinY = Infinity;
    for (const node of rawPositioned) {
      if (node.data.side === 'left') leftMinY = Math.min(leftMinY, node.position.y);
      if (node.data.side === 'right') rightMinY = Math.min(rightMinY, node.position.y);
    }
    const targetTopY = Math.min(leftMinY, rightMinY);
    const leftShift = leftMinY === Infinity ? 0 : targetTopY - leftMinY;
    const rightShift = rightMinY === Infinity ? 0 : targetTopY - rightMinY;

    const positioned = rawPositioned.map((node) => {
      if (node.data.side === 'left' && leftShift !== 0) {
        return { ...node, position: { x: node.position.x, y: node.position.y + leftShift } };
      }
      if (node.data.side === 'right' && rightShift !== 0) {
        return { ...node, position: { x: node.position.x, y: node.position.y + rightShift } };
      }
      return node;
    });

    // Stamp sourcePosition/targetPosition so bezier edges curve from the correct side
    const leftEdgeIds = new Set(leftEdges.map((e) => e.id));
    const rightEdgeIds = new Set(rightEdges.map((e) => e.id));
    const positionedEdges = edges.map((edge) => {
      if (leftEdgeIds.has(edge.id)) {
        return { ...edge, sourcePosition: Position.Left, targetPosition: Position.Right };
      }
      if (rightEdgeIds.has(edge.id)) {
        return { ...edge, sourcePosition: Position.Right, targetPosition: Position.Left };
      }
      // Cross-links / user links: infer from node sides
      const srcSide = positioned.find((n) => n.id === edge.source)?.data.side;
      const tgtSide = positioned.find((n) => n.id === edge.target)?.data.side;
      return {
        ...edge,
        sourcePosition: srcSide === 'left' ? Position.Left : Position.Right,
        targetPosition: tgtSide === 'left' ? Position.Right : Position.Left,
      };
    });

    return { nodes: positioned, edges: positionedEdges };
  }, [nodes, edges]);
}

/** Group nodes by dagre x (rank) and return the max width per rank */
function rankMaxWidths(
  nodes: Node<NodeData>[],
  positions: Map<string, { x: number; y: number }>,
): Map<number, number> {
  const maxW = new Map<number, number>();
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const rank = Math.round(pos.x);
    const w = NODE_WIDTH[node.data.nodeType];
    maxW.set(rank, Math.max(maxW.get(rank) ?? 0, w));
  }
  return maxW;
}

function runDagre(
  nodes: Node<NodeData>[],
  edges: Edge[],
  rankdir: 'LR' | 'RL',
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep: 60, ranksep: 130 });

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
