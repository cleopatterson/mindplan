import { useState, useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { FinancialPlan, ParseResponse, Insight, InsightsResponse } from 'shared/types';

export type AppState = 'upload' | 'parsing' | 'dashboard';

export function useFinancialData() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [data, setData] = useState<FinancialPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [hoveredNodeIds, setHoveredNodeIds] = useState<Set<string>>(new Set());
  const [userLinks, setUserLinks] = useState<Edge[]>([]);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

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

      // Fire-and-forget insights fetch (non-blocking)
      fetchInsights(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAppState('upload');
    }
  }, []);

  const fetchInsights = useCallback(async (plan: FinancialPlan) => {
    setInsightsLoading(true);
    try {
      console.time('⏱ [client] Fetch /api/insights');
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: plan }),
      });
      const json: InsightsResponse = await res.json();
      console.timeEnd('⏱ [client] Fetch /api/insights');
      if (json.success && json.insights) {
        setInsights(json.insights);
      }
    } catch (err) {
      console.error('[insights] Failed to fetch insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const dismissInsight = useCallback((index: number) => {
    setInsights((prev) => prev ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setSelectedNodeIds(new Set());
    setHighlightedNodeIds(new Set());
    setHoveredNodeIds(new Set());
    setUserLinks([]);
    setInsights(null);
    setInsightsLoading(false);
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

  /** Resolve a gap — remove it from the list and optionally update the field value */
  const resolveGap = useCallback((gapIndex: number, value?: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const gap = prev.dataGaps[gapIndex];
      if (!gap) return prev;

      // Remove the gap
      let updated: FinancialPlan = {
        ...prev,
        dataGaps: prev.dataGaps.filter((_, i) => i !== gapIndex),
      };

      // Apply the value if provided, using nodeId for precise targeting
      if (value && gap.nodeId && gap.field) {
        const numVal = parseFloat(value.replace(/[,$]/g, ''));
        if (!isNaN(numVal)) {
          updated = applyGapValue(updated, gap.nodeId, gap.field, numVal);
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

  /** Delete a node by ID — removes from plan data and deselects */
  const deleteNode = useCallback((nodeId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return removeNode(prev, nodeId);
    });
    setSelectedNodeIds((prev) => {
      if (!prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
    // Clean up any user links referencing this node
    setUserLinks((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, []);

  return {
    appState, data, error,
    selectedNodeIds, selectNode,
    highlightedNodeIds, toggleHighlight, clearHighlight,
    hoveredNodeIds, hoverHighlight,
    userLinks, addLink, removeLink,
    insights, insightsLoading, dismissInsight,
    uploadFile, reset, resolveGap, updateNodeField, deleteNode,
  };
}

/** Apply a resolved value to the exact node by ID (immutable) */
function applyGapValue(plan: FinancialPlan, nodeId: string, field: string, value: number): FinancialPlan {
  // Clients
  const ci = plan.clients.findIndex((c) => c.id === nodeId);
  if (ci !== -1) {
    const c = plan.clients[ci];
    const updated = field === 'age' ? { ...c, age: value }
      : field === 'income' ? { ...c, income: value }
      : field === 'superBalance' ? { ...c, superBalance: value }
      : c;
    return { ...plan, clients: plan.clients.map((cl, i) => i === ci ? updated : cl) };
  }

  // Family members
  for (let mi = 0; mi < (plan.familyMembers ?? []).length; mi++) {
    const member = plan.familyMembers[mi];
    if (member.id === nodeId && field === 'age') {
      const members = plan.familyMembers.map((m, i) => i === mi ? { ...m, age: value } : m);
      return { ...plan, familyMembers: members };
    }
    for (let gi = 0; gi < (member.children ?? []).length; gi++) {
      if (member.children[gi].id === nodeId && field === 'age') {
        const children = member.children.map((gc, j) => j === gi ? { ...gc, age: value } : gc);
        const members = plan.familyMembers.map((m, i) => i === mi ? { ...m, children } : m);
        return { ...plan, familyMembers: members };
      }
    }
  }

  // Personal assets
  const pai = plan.personalAssets.findIndex((a) => a.id === nodeId);
  if (pai !== -1) {
    return { ...plan, personalAssets: plan.personalAssets.map((a, i) => i === pai ? { ...a, value } : a) };
  }

  // Personal liabilities
  const pli = plan.personalLiabilities.findIndex((l) => l.id === nodeId);
  if (pli !== -1) {
    return { ...plan, personalLiabilities: plan.personalLiabilities.map((l, i) => i === pli ? { ...l, amount: value } : l) };
  }

  // Entity assets and liabilities
  for (let ei = 0; ei < plan.entities.length; ei++) {
    const entity = plan.entities[ei];
    const ai = entity.assets.findIndex((a) => a.id === nodeId);
    if (ai !== -1) {
      const updated = { ...entity, assets: entity.assets.map((a, i) => i === ai ? { ...a, value } : a) };
      return { ...plan, entities: plan.entities.map((e, i) => i === ei ? updated : e) };
    }
    const li = entity.liabilities.findIndex((l) => l.id === nodeId);
    if (li !== -1) {
      const updated = { ...entity, liabilities: entity.liabilities.map((l, i) => i === li ? { ...l, amount: value } : l) };
      return { ...plan, entities: plan.entities.map((e, i) => i === ei ? updated : e) };
    }
  }

  return plan;
}

/** Remove a node by ID from the plan (immutable) */
function removeNode(plan: FinancialPlan, nodeId: string): FinancialPlan {
  // Clients
  if (plan.clients.some((c) => c.id === nodeId)) {
    return { ...plan, clients: plan.clients.filter((c) => c.id !== nodeId) };
  }

  // Personal assets
  if (plan.personalAssets.some((a) => a.id === nodeId)) {
    return {
      ...plan,
      personalAssets: plan.personalAssets.filter((a) => a.id !== nodeId),
      dataGaps: plan.dataGaps.filter((g) => g.nodeId !== nodeId),
    };
  }

  // Personal liabilities
  if (plan.personalLiabilities.some((l) => l.id === nodeId)) {
    return {
      ...plan,
      personalLiabilities: plan.personalLiabilities.filter((l) => l.id !== nodeId),
      dataGaps: plan.dataGaps.filter((g) => g.nodeId !== nodeId),
    };
  }

  // Entities (remove entire entity + its gaps)
  if (plan.entities.some((e) => e.id === nodeId)) {
    const entity = plan.entities.find((e) => e.id === nodeId)!;
    const childIds = new Set([
      ...entity.assets.map((a) => a.id),
      ...entity.liabilities.map((l) => l.id),
    ]);
    return {
      ...plan,
      entities: plan.entities.filter((e) => e.id !== nodeId),
      dataGaps: plan.dataGaps.filter((g) => g.nodeId !== nodeId && !childIds.has(g.nodeId ?? '')),
    };
  }

  // Entity-owned assets
  for (const entity of plan.entities) {
    if (entity.assets.some((a) => a.id === nodeId)) {
      return {
        ...plan,
        entities: plan.entities.map((e) =>
          e.id === entity.id ? { ...e, assets: e.assets.filter((a) => a.id !== nodeId) } : e,
        ),
        dataGaps: plan.dataGaps.filter((g) => g.nodeId !== nodeId),
      };
    }
    if (entity.liabilities.some((l) => l.id === nodeId)) {
      return {
        ...plan,
        entities: plan.entities.map((e) =>
          e.id === entity.id ? { ...e, liabilities: e.liabilities.filter((l) => l.id !== nodeId) } : e,
        ),
        dataGaps: plan.dataGaps.filter((g) => g.nodeId !== nodeId),
      };
    }
  }

  // Estate planning items
  if (plan.estatePlanning?.some((e) => e.id === nodeId)) {
    return { ...plan, estatePlanning: plan.estatePlanning.filter((e) => e.id !== nodeId) };
  }

  // Family members (including grandchildren)
  if (plan.familyMembers?.some((m) => m.id === nodeId)) {
    return { ...plan, familyMembers: plan.familyMembers.filter((m) => m.id !== nodeId) };
  }
  for (const member of plan.familyMembers ?? []) {
    if (member.children?.some((gc) => gc.id === nodeId)) {
      return {
        ...plan,
        familyMembers: plan.familyMembers.map((m) =>
          m.id === member.id ? { ...m, children: m.children.filter((gc) => gc.id !== nodeId) } : m,
        ),
      };
    }
  }

  // Goals
  if (plan.goals?.some((g) => g.id === nodeId)) {
    return { ...plan, goals: plan.goals.filter((g) => g.id !== nodeId) };
  }

  // Relationships
  if (plan.relationships?.some((r) => r.id === nodeId)) {
    return { ...plan, relationships: plan.relationships.filter((r) => r.id !== nodeId) };
  }

  return plan;
}
