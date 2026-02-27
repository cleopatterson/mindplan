import { useMemo } from 'react';
import type { FinancialPlan } from 'shared/types';

export interface SankeyNode {
  id: string;
  label: string;
  value: number;
  column: 0 | 1 | 2;           // 0=Income, 1=Structures, 2=AssetCategories
  color: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  isLiability?: boolean;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/** Map raw asset types to display-friendly grouped categories (mirrors ASSET_GROUP in calculations.ts) */
const ASSET_GROUP: Record<string, string> = {
  property: 'Property',
  shares: 'Shares',
  managed_fund: 'Shares',
  cash: 'Cash',
  super: 'Super',
  pension: 'Super',
  insurance: 'Insurance',
  vehicle: 'Vehicle',
  other: 'Other',
};

const ASSET_CATEGORY_COLORS: Record<string, string> = {
  Property: '#f59e0b',   // amber
  Shares: '#3b82f6',     // blue
  Cash: '#10b981',       // emerald
  Super: '#f97316',      // orange
  Insurance: '#8b5cf6',  // violet
  Vehicle: '#6366f1',    // indigo
  Other: '#64748b',      // slate
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  trust: '#22c55e',      // green
  smsf: '#f97316',       // orange
  company: '#a855f7',    // purple
  partnership: '#06b6d4', // cyan
};

const INCOME_COLOR = '#3b82f6';       // blue
const PERSONAL_COLOR = '#6366f1';     // indigo
const LIABILITY_COLOR = '#ef4444';    // red

/**
 * Transforms a FinancialPlan into Sankey diagram data.
 *
 * Layout: Income (col 0) → Structures (col 1) → Asset Categories (col 2)
 *
 * Income is distributed proportionally across structures based on the
 * client's asset ownership in each structure. Liabilities appear as
 * drain nodes off their parent structure.
 */
export function useSankeyData(plan: FinancialPlan): SankeyData {
  return useMemo(() => buildSankeyData(plan), [plan]);
}

function buildSankeyData(plan: FinancialPlan): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const nodeSet = new Set<string>();

  const addNode = (node: SankeyNode) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  // ── Column 1: Structures ──
  // "Personal" bucket for personal assets/liabilities
  // One node per entity (trust, SMSF, company, partnership)

  const personalAssetTotal = plan.personalAssets.reduce((s, a) => s + (a.value || 0), 0);
  const personalLiabilityTotal = plan.personalLiabilities.reduce((s, l) => s + (l.amount || 0), 0);
  const hasPersonal = personalAssetTotal > 0 || personalLiabilityTotal > 0;

  if (hasPersonal) {
    addNode({ id: 'struct-personal', label: 'Personal', value: personalAssetTotal, column: 1, color: PERSONAL_COLOR });
  }

  for (const entity of plan.entities) {
    const assetTotal = entity.assets.reduce((s, a) => s + (a.value || 0), 0);
    const liabilityTotal = entity.liabilities.reduce((s, l) => s + (l.amount || 0), 0);
    if (assetTotal > 0 || liabilityTotal > 0) {
      addNode({
        id: `struct-${entity.id}`,
        label: entity.name,
        value: assetTotal,
        column: 1,
        color: ENTITY_TYPE_COLORS[entity.type] || PERSONAL_COLOR,
      });
    }
  }

  // ── Column 2: Asset Categories ──
  // Aggregate values per category per structure, then create links

  const categoryTotals: Record<string, number> = {};

  // Personal assets → categories
  const personalByCategory: Record<string, number> = {};
  for (const asset of plan.personalAssets) {
    const group = ASSET_GROUP[asset.type] ?? 'Other';
    const val = asset.value || 0;
    if (val > 0) {
      personalByCategory[group] = (personalByCategory[group] || 0) + val;
      categoryTotals[group] = (categoryTotals[group] || 0) + val;
    }
  }

  if (hasPersonal) {
    for (const [group, value] of Object.entries(personalByCategory)) {
      links.push({ source: 'struct-personal', target: `cat-${group}`, value });
    }
  }

  // Entity assets → categories
  for (const entity of plan.entities) {
    const entityAssetTotal = entity.assets.reduce((s, a) => s + (a.value || 0), 0);
    if (entityAssetTotal === 0 && entity.liabilities.reduce((s, l) => s + (l.amount || 0), 0) === 0) continue;

    const byCategory: Record<string, number> = {};
    for (const asset of entity.assets) {
      const group = ASSET_GROUP[asset.type] ?? 'Other';
      const val = asset.value || 0;
      if (val > 0) {
        byCategory[group] = (byCategory[group] || 0) + val;
        categoryTotals[group] = (categoryTotals[group] || 0) + val;
      }
    }

    for (const [group, value] of Object.entries(byCategory)) {
      links.push({ source: `struct-${entity.id}`, target: `cat-${group}`, value });
    }
  }

  // Add category nodes
  for (const [group, total] of Object.entries(categoryTotals)) {
    addNode({
      id: `cat-${group}`,
      label: group,
      value: total,
      column: 2,
      color: ASSET_CATEGORY_COLORS[group] || '#64748b',
    });
  }

  // ── Column 2 (drains): Liabilities ──
  // Each liability group per structure → red drain node

  if (personalLiabilityTotal > 0) {
    const liabId = 'liab-personal';
    addNode({ id: liabId, label: 'Liabilities', value: personalLiabilityTotal, column: 2, color: LIABILITY_COLOR });
    links.push({ source: 'struct-personal', target: liabId, value: personalLiabilityTotal, isLiability: true });
  }

  for (const entity of plan.entities) {
    const liabTotal = entity.liabilities.reduce((s, l) => s + (l.amount || 0), 0);
    if (liabTotal > 0) {
      const liabId = `liab-${entity.id}`;
      addNode({ id: liabId, label: 'Debt', value: liabTotal, column: 2, color: LIABILITY_COLOR });
      links.push({ source: `struct-${entity.id}`, target: liabId, value: liabTotal, isLiability: true });
    }
  }

  // ── Column 0: Income ──
  // One node per client with income > 0.
  // Distribute proportionally based on how much the client owns in each structure.

  for (const client of plan.clients) {
    const income = client.income || 0;
    if (income <= 0) continue;

    const incomeId = `income-${client.id}`;
    addNode({ id: incomeId, label: `${client.name}`, value: income, column: 0, color: INCOME_COLOR });

    // Calculate how much this client "owns" in each structure
    const ownership: { structId: string; value: number }[] = [];

    // Personal assets owned by this client
    if (hasPersonal) {
      let personalOwned = 0;
      for (const asset of plan.personalAssets) {
        if (asset.ownerIds.includes(client.id)) {
          // Split value by number of owners
          const share = (asset.value || 0) / (asset.ownerIds.length || 1);
          personalOwned += share;
        }
      }
      if (personalOwned > 0) {
        ownership.push({ structId: 'struct-personal', value: personalOwned });
      }
    }

    // Entity assets linked to this client
    for (const entity of plan.entities) {
      if (!entity.linkedClientIds.includes(client.id)) continue;
      const entityAssetTotal = entity.assets.reduce((s, a) => s + (a.value || 0), 0);
      if (entityAssetTotal > 0) {
        // Split by number of linked clients
        const share = entityAssetTotal / (entity.linkedClientIds.length || 1);
        ownership.push({ structId: `struct-${entity.id}`, value: share });
      }
    }

    // Distribute income proportionally
    const totalOwned = ownership.reduce((s, o) => s + o.value, 0);
    if (totalOwned > 0) {
      for (const { structId, value } of ownership) {
        const proportion = value / totalOwned;
        const incomeShare = Math.round(income * proportion);
        if (incomeShare > 0) {
          links.push({ source: incomeId, target: structId, value: incomeShare });
        }
      }
    } else {
      // No ownership data — split evenly across all structures
      const structNodes = nodes.filter((n) => n.column === 1);
      if (structNodes.length > 0) {
        const share = Math.round(income / structNodes.length);
        for (const sn of structNodes) {
          if (share > 0) {
            links.push({ source: incomeId, target: sn.id, value: share });
          }
        }
      }
    }
  }

  // Remove orphaned nodes (nodes with no links)
  const linkedNodeIds = new Set<string>();
  for (const link of links) {
    linkedNodeIds.add(link.source);
    linkedNodeIds.add(link.target);
  }
  const connectedNodes = nodes.filter((n) => linkedNodeIds.has(n.id));

  return { nodes: connectedNodes, links };
}
