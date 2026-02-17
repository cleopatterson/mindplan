import { useState, useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { FinancialPlan, ParseResponse } from 'shared/types';

export type AppState = 'upload' | 'parsing' | 'dashboard';

export function useFinancialData() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [data, setData] = useState<FinancialPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeIds, setHoveredNodeIds] = useState<Set<string>>(new Set());
  const [userLinks, setUserLinks] = useState<Edge[]>([]);

  const uploadFile = useCallback(async (file: File) => {
    setAppState('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const json: ParseResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to parse document');
      }

      setData(json.data);
      setAppState('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAppState('upload');
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setSelectedNodeIds(new Set());
    setHighlightedNodeIds(new Set());
    setHoveredNodeIds(new Set());
    setUserLinks([]);
    setAppState('upload');
  }, []);

  const addLink = useCallback((edge: Edge) => {
    setUserLinks((prev) => [...prev, edge]);
  }, []);

  const removeLink = useCallback((edgeId: string) => {
    setUserLinks((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  /** Select a node — shift-click adds to selection, normal click replaces */
  const selectNode = useCallback((id: string | null, additive: boolean) => {
    if (id === null) {
      setSelectedNodeIds(new Set());
      return;
    }
    setSelectedNodeIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);

  /** Preview highlight on hover (lighter effect) */
  const hoverHighlight = useCallback((nodeIds: string[]) => {
    setHoveredNodeIds(new Set(nodeIds));
  }, []);

  /** Toggle highlight — if same IDs already highlighted, clear them */
  const toggleHighlight = useCallback((nodeIds: string[]) => {
    setHighlightedNodeIds((prev) => {
      const newSet = new Set(nodeIds);
      // If clicking the same card again, clear
      if (prev.size === newSet.size && [...prev].every((id) => newSet.has(id))) {
        return new Set();
      }
      return newSet;
    });
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedNodeIds(new Set());
  }, []);

  /** Resolve a gap — remove it from the list and optionally update a numeric field */
  const resolveGap = useCallback((gapIndex: number, value?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);
      const gap = updated.dataGaps[gapIndex];
      if (!gap) return prev;

      // Try to update the actual field if a numeric value was provided
      if (value && gap.field) {
        const numVal = parseFloat(value.replace(/[,$]/g, ''));
        if (!isNaN(numVal)) {
          applyGapValue(updated, gap.entityId, gap.field, numVal);
        }
      }

      // Remove the gap
      updated.dataGaps.splice(gapIndex, 1);
      return updated;
    });
  }, []);

  /** Update a specific field on a node by ID */
  const updateNodeField = useCallback((nodeId: string, field: string, value: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const updated = structuredClone(prev);

      // Try clients
      for (const client of updated.clients) {
        if (client.id === nodeId) {
          if (field === 'name') client.name = value;
          else if (field === 'age') client.age = value ? parseInt(value.replace(/[,$]/g, '')) : null;
          else if (field === 'occupation') client.occupation = value || null;
          else if (field === 'income') client.income = value ? parseFloat(value.replace(/[,$]/g, '')) : null;
          else if (field === 'superBalance') client.superBalance = value ? parseFloat(value.replace(/[,$]/g, '')) : null;
          return updated;
        }
      }

      // Try entities
      for (const entity of updated.entities) {
        if (entity.id === nodeId) {
          if (field === 'name') entity.name = value;
          else if (field === 'role') entity.role = value || null;
          else if (field === 'trusteeName') entity.trusteeName = value || null;
          else if (field === 'trusteeType') entity.trusteeType = (value === 'individual' || value === 'corporate') ? value : null;
          return updated;
        }
      }

      // Try assets (personal + entity-owned) — search without flattening
      for (const assets of [updated.personalAssets, ...updated.entities.map((e) => e.assets)]) {
        for (const asset of assets) {
          if (asset.id === nodeId) {
            if (field === 'name') asset.name = value;
            else if (field === 'value') asset.value = value ? parseFloat(value.replace(/[,$]/g, '')) : null;
            else if (field === 'details') asset.details = value || null;
            return updated;
          }
        }
      }

      // Try liabilities (personal + entity-owned) — search without flattening
      for (const liabilities of [updated.personalLiabilities, ...updated.entities.map((e) => e.liabilities)]) {
        for (const liability of liabilities) {
          if (liability.id === nodeId) {
            if (field === 'name') liability.name = value;
            else if (field === 'amount') liability.amount = value ? parseFloat(value.replace(/[,$]/g, '')) : null;
            else if (field === 'interestRate') liability.interestRate = value ? parseFloat(value.replace(/[,$]/g, '')) : null;
            else if (field === 'details') liability.details = value || null;
            return updated;
          }
        }
      }

      return prev;
    });
  }, []);

  return {
    appState, data, error,
    selectedNodeIds, selectNode,
    highlightedNodeIds, toggleHighlight, clearHighlight,
    hoveredNodeIds, hoverHighlight,
    userLinks, addLink, removeLink,
    uploadFile, reset, resolveGap, updateNodeField,
  };
}

/** Apply a resolved value to the matching object in the plan */
function applyGapValue(plan: FinancialPlan, entityId: string | null, field: string, value: number) {
  // Client-level fields
  if (!entityId) {
    for (const client of plan.clients) {
      if (field === 'age' && client.age === null) { client.age = value; return; }
      if (field === 'income' && client.income === null) { client.income = value; return; }
      if (field === 'superBalance' && client.superBalance === null) { client.superBalance = value; return; }
    }
    // Personal asset values
    for (const asset of plan.personalAssets) {
      if (field === 'value' && asset.value === null) { asset.value = value; return; }
    }
    return;
  }

  // Entity-level fields
  const entity = plan.entities.find((e) => e.id === entityId);
  if (!entity) return;

  for (const asset of entity.assets) {
    if (field === 'value' && asset.value === null) { asset.value = value; return; }
  }
  for (const liability of entity.liabilities) {
    if (field === 'amount' && liability.amount === null) { liability.amount = value; return; }
  }
}
