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

      console.time('⏱ [client] Total upload→render');
      console.time('⏱ [client] Fetch /api/parse');
      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const json: ParseResponse = await res.json();
      console.timeEnd('⏱ [client] Fetch /api/parse');

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to parse document');
      }

      console.log(`⏱ [client] Response payload: ${JSON.stringify(json.data).length} chars`);
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
      const gap = prev.dataGaps[gapIndex];
      if (!gap) return prev;

      // Start with gap removal (targeted — only clone the dataGaps array)
      let updated: FinancialPlan = {
        ...prev,
        dataGaps: prev.dataGaps.filter((_, i) => i !== gapIndex),
      };

      // Try to update the actual field if a numeric value was provided
      if (value && gap.field) {
        const numVal = parseFloat(value.replace(/[,$]/g, ''));
        if (!isNaN(numVal)) {
          updated = applyGapValue(updated, gap.entityId, gap.field, numVal);
        }
      }

      return updated;
    });
  }, []);

  /** Update a specific field on a node by ID */
  const updateNodeField = useCallback((nodeId: string, field: string, value: string) => {
    setData((prev) => {
      if (!prev) return prev;

      // Helper to apply a field update to a client
      const updateClient = (c: typeof prev.clients[0]) => {
        if (field === 'name') return { ...c, name: value };
        if (field === 'age') return { ...c, age: value ? parseInt(value.replace(/[,$]/g, '')) : null };
        if (field === 'occupation') return { ...c, occupation: value || null };
        if (field === 'income') return { ...c, income: value ? parseFloat(value.replace(/[,$]/g, '')) : null };
        if (field === 'superBalance') return { ...c, superBalance: value ? parseFloat(value.replace(/[,$]/g, '')) : null };
        return c;
      };

      // Helper to apply a field update to an entity
      const updateEntity = (e: typeof prev.entities[0]) => {
        if (field === 'name') return { ...e, name: value };
        if (field === 'role') return { ...e, role: value || null };
        if (field === 'trusteeName') return { ...e, trusteeName: value || null };
        if (field === 'trusteeType') return { ...e, trusteeType: (value === 'individual' || value === 'corporate') ? value as 'individual' | 'corporate' : null };
        return e;
      };

      // Helper to apply a field update to an asset
      const updateAsset = (a: typeof prev.personalAssets[0]) => {
        if (field === 'name') return { ...a, name: value };
        if (field === 'value') return { ...a, value: value ? parseFloat(value.replace(/[,$]/g, '')) : null };
        if (field === 'details') return { ...a, details: value || null };
        return a;
      };

      // Helper to apply a field update to a liability
      const updateLiability = (l: typeof prev.personalLiabilities[0]) => {
        if (field === 'name') return { ...l, name: value };
        if (field === 'amount') return { ...l, amount: value ? parseFloat(value.replace(/[,$]/g, '')) : null };
        if (field === 'interestRate') return { ...l, interestRate: value ? parseFloat(value.replace(/[,$]/g, '')) : null };
        if (field === 'details') return { ...l, details: value || null };
        return l;
      };

      // Try clients — only clone the matched client
      const clientIdx = prev.clients.findIndex((c) => c.id === nodeId);
      if (clientIdx !== -1) {
        const clients = prev.clients.map((c, i) => i === clientIdx ? updateClient(c) : c);
        return { ...prev, clients };
      }

      // Try entities (entity-level fields only)
      const entityIdx = prev.entities.findIndex((e) => e.id === nodeId);
      if (entityIdx !== -1) {
        const entities = prev.entities.map((e, i) => i === entityIdx ? updateEntity(e) : e);
        return { ...prev, entities };
      }

      // Try personal assets
      const personalAssetIdx = prev.personalAssets.findIndex((a) => a.id === nodeId);
      if (personalAssetIdx !== -1) {
        const personalAssets = prev.personalAssets.map((a, i) => i === personalAssetIdx ? updateAsset(a) : a);
        return { ...prev, personalAssets };
      }

      // Try entity-owned assets
      for (let ei = 0; ei < prev.entities.length; ei++) {
        const assetIdx = prev.entities[ei].assets.findIndex((a) => a.id === nodeId);
        if (assetIdx !== -1) {
          const entities = prev.entities.map((e, i) =>
            i === ei ? { ...e, assets: e.assets.map((a, j) => j === assetIdx ? updateAsset(a) : a) } : e
          );
          return { ...prev, entities };
        }
      }

      // Try personal liabilities
      const personalLiabilityIdx = prev.personalLiabilities.findIndex((l) => l.id === nodeId);
      if (personalLiabilityIdx !== -1) {
        const personalLiabilities = prev.personalLiabilities.map((l, i) => i === personalLiabilityIdx ? updateLiability(l) : l);
        return { ...prev, personalLiabilities };
      }

      // Try entity-owned liabilities
      for (let ei = 0; ei < prev.entities.length; ei++) {
        const liabilityIdx = prev.entities[ei].liabilities.findIndex((l) => l.id === nodeId);
        if (liabilityIdx !== -1) {
          const entities = prev.entities.map((e, i) =>
            i === ei ? { ...e, liabilities: e.liabilities.map((l, j) => j === liabilityIdx ? updateLiability(l) : l) } : e
          );
          return { ...prev, entities };
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

/** Apply a resolved value to the matching object in the plan (immutable) */
function applyGapValue(plan: FinancialPlan, entityId: string | null, field: string, value: number): FinancialPlan {
  // Client-level fields
  if (!entityId) {
    const clientIdx = plan.clients.findIndex(
      (c) => (field === 'age' && c.age === null) || (field === 'income' && c.income === null) || (field === 'superBalance' && c.superBalance === null)
    );
    if (clientIdx !== -1) {
      const c = plan.clients[clientIdx];
      const updated = field === 'age' ? { ...c, age: value }
        : field === 'income' ? { ...c, income: value }
        : { ...c, superBalance: value };
      return { ...plan, clients: plan.clients.map((cl, i) => i === clientIdx ? updated : cl) };
    }
    // Personal asset values
    const assetIdx = plan.personalAssets.findIndex((a) => field === 'value' && a.value === null);
    if (assetIdx !== -1) {
      return { ...plan, personalAssets: plan.personalAssets.map((a, i) => i === assetIdx ? { ...a, value } : a) };
    }
    return plan;
  }

  // Entity-level fields
  const entityIdx = plan.entities.findIndex((e) => e.id === entityId);
  if (entityIdx === -1) return plan;
  const entity = plan.entities[entityIdx];

  const assetIdx = entity.assets.findIndex((a) => field === 'value' && a.value === null);
  if (assetIdx !== -1) {
    const updatedEntity = { ...entity, assets: entity.assets.map((a, i) => i === assetIdx ? { ...a, value } : a) };
    return { ...plan, entities: plan.entities.map((e, i) => i === entityIdx ? updatedEntity : e) };
  }

  const liabilityIdx = entity.liabilities.findIndex((l) => field === 'amount' && l.amount === null);
  if (liabilityIdx !== -1) {
    const updatedEntity = { ...entity, liabilities: entity.liabilities.map((l, i) => i === liabilityIdx ? { ...l, amount: value } : l) };
    return { ...plan, entities: plan.entities.map((e, i) => i === entityIdx ? updatedEntity : e) };
  }

  return plan;
}
