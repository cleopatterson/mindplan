import type { FinancialPlan, Asset, Liability, Entity } from 'shared/types';

/** Sum of all asset values across all entities + personal */
export function totalAssets(plan: FinancialPlan): number {
  let total = sumAssets(plan.personalAssets);
  for (const entity of plan.entities) {
    total += sumAssets(entity.assets);
  }
  return total;
}

/** Sum of all liability amounts across all entities + personal */
export function totalLiabilities(plan: FinancialPlan): number {
  let total = sumLiabilities(plan.personalLiabilities);
  for (const entity of plan.entities) {
    total += sumLiabilities(entity.liabilities);
  }
  return total;
}

export function netWorth(plan: FinancialPlan): number {
  return totalAssets(plan) - totalLiabilities(plan);
}

/** Net equity per entity */
export function entityEquity(entity: Entity): number {
  return sumAssets(entity.assets) - sumLiabilities(entity.liabilities);
}

/** Asset allocation by type as { type: percentage } */
export function assetAllocation(plan: FinancialPlan): Record<string, number> {
  const byType: Record<string, number> = {};
  const allAssets = [...plan.personalAssets, ...plan.entities.flatMap((e) => e.assets)];

  for (const asset of allAssets) {
    byType[asset.type] = (byType[asset.type] || 0) + (asset.value || 0);
  }

  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  if (total === 0) return byType;

  const percentages: Record<string, number> = {};
  for (const [type, value] of Object.entries(byType)) {
    percentages[type] = Math.round((value / total) * 100);
  }
  return percentages;
}

/** Liquid (cash, shares, managed_fund) vs illiquid percentage */
export function liquidityBreakdown(plan: FinancialPlan): { liquid: number; illiquid: number } {
  const liquidTypes = new Set(['cash', 'shares', 'managed_fund']);
  const allAssets = [...plan.personalAssets, ...plan.entities.flatMap((e) => e.assets)];

  let liquid = 0;
  let illiquid = 0;
  for (const asset of allAssets) {
    if (liquidTypes.has(asset.type)) {
      liquid += asset.value || 0;
    } else {
      illiquid += asset.value || 0;
    }
  }

  const total = liquid + illiquid;
  if (total === 0) return { liquid: 0, illiquid: 0 };
  return {
    liquid: Math.round((liquid / total) * 100),
    illiquid: Math.round((illiquid / total) * 100),
  };
}

/** % of wealth per entity */
export function entityConcentration(plan: FinancialPlan): { name: string; pct: number }[] {
  const total = totalAssets(plan);
  if (total === 0) return [];

  const result: { name: string; pct: number }[] = [];

  const personalTotal = sumAssets(plan.personalAssets);
  if (personalTotal > 0) {
    result.push({ name: 'Personal', pct: Math.round((personalTotal / total) * 100) });
  }

  for (const entity of plan.entities) {
    const entityTotal = sumAssets(entity.assets);
    if (entityTotal > 0) {
      result.push({ name: entity.name, pct: Math.round((entityTotal / total) * 100) });
    }
  }

  return result.sort((a, b) => b.pct - a.pct);
}

function sumAssets(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + (a.value || 0), 0);
}

function sumLiabilities(liabilities: Liability[]): number {
  return liabilities.reduce((sum, l) => sum + (l.amount || 0), 0);
}

// ── Node ID selectors for highlighting ──

/** All asset + liability IDs (net worth) */
export function netWorthNodeIds(plan: FinancialPlan): string[] {
  return [
    ...plan.personalAssets.map((a) => a.id),
    ...plan.personalLiabilities.map((l) => l.id),
    ...plan.entities.flatMap((e) => [...e.assets.map((a) => a.id), ...e.liabilities.map((l) => l.id)]),
  ];
}

/** All asset IDs (allocation) */
export function allAssetNodeIds(plan: FinancialPlan): string[] {
  return [
    ...plan.personalAssets.map((a) => a.id),
    ...plan.entities.flatMap((e) => e.assets.map((a) => a.id)),
  ];
}

/** Liquid asset IDs */
export function liquidAssetNodeIds(plan: FinancialPlan): string[] {
  const liquidTypes = new Set(['cash', 'shares', 'managed_fund']);
  const all = [...plan.personalAssets, ...plan.entities.flatMap((e) => e.assets)];
  return all.filter((a) => liquidTypes.has(a.type)).map((a) => a.id);
}

/** Node IDs for a specific entity (its own ID + its assets + liabilities) */
export function entityNodeIds(plan: FinancialPlan, entityName: string): string[] {
  if (entityName === 'Personal') {
    return [
      ...plan.personalAssets.map((a) => a.id),
      ...plan.personalLiabilities.map((l) => l.id),
      ...plan.clients.map((c) => c.id),
    ];
  }
  const entity = plan.entities.find((e) => e.name === entityName);
  if (!entity) return [];
  return [entity.id, ...entity.assets.map((a) => a.id), ...entity.liabilities.map((l) => l.id)];
}

export function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}
