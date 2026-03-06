import { useRef, useCallback, useEffect, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../utils/transformToGraph';

/** Timing constants */
const STEP_MS = 70;           // delay between successive nodes
const NODE_ANIM_MS = 500;     // node pop-in animation duration
const EDGE_ANIM_MS = 600;     // edge fade-in animation duration
const EDGE_BUFFER_MS = 120;   // extra delay for edges after both nodes visible

/**
 * Computes DFS-order reveal delays for nodes and edges.
 * Traces each branch to its leaves before moving to the next,
 * so the map reveals one complete branch at a time — e.g.
 * Dorothy → Entities → DJ Trust → its properties → back to next entity → …
 *
 * Only fires once per mount (new upload) — subsequent
 * calls (expand/collapse, highlights, edits) return nodes/edges unchanged.
 *
 * After all animations complete, a React state update triggers
 * re-render to remove the CSS classes cleanly via reconciliation
 * (never via direct DOM manipulation, which desynchronizes React).
 */
export function useRevealAnimation() {
  const revealedDataRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // State-based cleanup: when flipped, applyReveal's identity changes,
  // forcing useMemo consumers to recompute and get clean (classless) edges.
  const [revealVersion, setRevealVersion] = useState(0);

  // Clean up timer on unmount — also reset state so Strict Mode re-mount works
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      revealedDataRef.current = false;
    };
  }, []);

  const applyReveal = useCallback(
    (
      nodes: Node<NodeData>[],
      edges: Edge[],
    ): { nodes: Node<NodeData>[]; edges: Edge[] } => {
      // Already revealed once this mount — return clean edges (no reveal classes).
      // React reconciliation will remove classes from the DOM naturally.
      if (revealedDataRef.current) {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }
        return { nodes, edges };
      }
      revealedDataRef.current = true;

      // ── Build adjacency from structural edges ──
      const childrenOf = new Map<string, string[]>();
      for (const edge of edges) {
        if (edge.data?.isUserLink || edge.data?.isCrossLink) continue;
        if (!childrenOf.has(edge.source)) childrenOf.set(edge.source, []);
        childrenOf.get(edge.source)!.push(edge.target);
      }

      const familyNode = nodes.find((n) => n.data.nodeType === 'family');
      const startId = familyNode?.id ?? nodes[0]?.id;
      if (!startId) return { nodes, edges };

      // ── DFS traversal — traces each branch to its leaves ──
      const order = new Map<string, number>();
      let idx = 0;

      function dfs(nodeId: string) {
        if (order.has(nodeId)) return;
        order.set(nodeId, idx++);
        for (const child of childrenOf.get(nodeId) ?? []) {
          dfs(child);
        }
      }

      dfs(startId);

      // Orphan nodes (not reachable from family) appear at the end
      for (const node of nodes) {
        if (!order.has(node.id)) order.set(node.id, idx++);
      }

      // ── Stamp reveal animation on nodes ──
      let maxNodeDelay = 0;
      const revealedNodes = nodes.map((node) => {
        const i = order.get(node.id) ?? 0;
        const delay = i * STEP_MS;
        if (delay > maxNodeDelay) maxNodeDelay = delay;
        return {
          ...node,
          className: `${node.className ?? ''} reveal-node`.trim(),
          style: {
            ...node.style,
            '--reveal-delay': `${delay}ms`,
          } as React.CSSProperties,
        };
      });

      // Edge delay = max(source delay, target delay) + small buffer
      const nodeDelay = (id: string) => (order.get(id) ?? 0) * STEP_MS;
      let maxEdgeDelay = 0;
      const revealedEdges = edges.map((edge) => {
        const delay = Math.max(nodeDelay(edge.source), nodeDelay(edge.target)) + EDGE_BUFFER_MS;
        if (delay > maxEdgeDelay) maxEdgeDelay = delay;
        return {
          ...edge,
          className: `${edge.className ?? ''} reveal-edge`.trim(),
          style: {
            ...edge.style,
            '--reveal-delay': `${delay}ms`,
          } as React.CSSProperties,
        };
      });

      // Schedule cleanup: trigger React state update to remove animation classes
      // via normal reconciliation (applyReveal returns clean edges once revealedDataRef is true).
      const totalDuration = Math.max(
        maxNodeDelay + NODE_ANIM_MS,
        maxEdgeDelay + EDGE_ANIM_MS,
      ) + 100;

      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        // Bump version to change applyReveal identity → useMemo recomputes → clean edges
        setRevealVersion((v) => v + 1);
      }, totalDuration);

      return { nodes: revealedNodes, edges: revealedEdges };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revealVersion],
  );

  const resetReveal = useCallback(() => {
    revealedDataRef.current = false;
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  }, []);

  return { applyReveal, resetReveal };
}
