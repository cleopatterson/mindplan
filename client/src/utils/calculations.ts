import type { FinancialPlan, Asset, Liability, Entity } from 'shared/types';

/** Flatten all assets across personal + entities (shared helper) */
function flatAssets(plan: FinancialPlan): Asset[] {
  const result = [...plan.personalAssets];
  for (const entity of plan.entities) {
    for (const asset of entity.assets) result.push(asset);
  }
  return result;
}

function sumValues(assets: Asset[]): number {
  let total = 0;
  for (const a of assets) total += a.value || 0;
  return total;
}

function sumAmounts(liabilities: Liability[]): number {
  let total = 0;
  for (const l of liabilities) total += l.amount || 0;
  return total;
}

/** Sum of all asset values across all entities + personal */
export function totalAssets(plan: FinancialPlan): number {
  return sumValues(plan.personalAssets) + plan.entities.reduce((s, e) => s + sumValues(e.assets), 0);
}

/** Sum of all liability amounts across all entities + personal */
export function totalLiabilities(plan: FinancialPlan): number {
  return sumAmounts(plan.personalLiabilities) + plan.entities.reduce((s, e) => s + sumAmounts(e.liabilities), 0);
}

export function netWorth(plan: FinancialPlan): number {
  return totalAssets(plan) - totalLiabilities(plan);
}

/** Net equity per entity */
export function entityEquity(entity: Entity): number {
  return sumValues(entity.assets) - sumAmounts(entity.liabilities);
}

/** Map raw asset types to display-friendly grouped categories */
const ASSET_GROUP: Record<string, string> = {
  property: 'Property',
  shares: 'Shares',
  managed_fund: 'Shares',   // managed funds grouped with shares
  cash: 'Cash',
  super: 'Super',
  insurance: 'Insurance',
  vehicle: 'Vehicle',
  other: 'Other',
};

/** Asset allocation by grouped category as { label: percentage }, sorted descending */
export function assetAllocation(plan: FinancialPlan): Record<string, number> {
  const byGroup: Record<string, number> = {};
  for (const asset of flatAssets(plan)) {
    const group = ASSET_GROUP[asset.type] ?? 'Other';
    byGroup[group] = (byGroup[group] || 0) + (asset.value || 0);
  }

  const total = Object.values(byGroup).reduce((a, b) => a + b, 0);
  if (total === 0) return byGroup;

  const entries = Object.entries(byGroup)
    .map(([group, value]) => [group, Math.round((value / total) * 100)] as const)
    .sort((a, b) => b[1] - a[1]);

  return Object.fromEntries(entries);
}

/** Liquid (cash, shares, managed_fund) vs illiquid percentage */
export function liquidityBreakdown(plan: FinancialPlan): { liquid: number; illiquid: number } {
  const liquidTypes = new Set(['cash', 'shares', 'managed_fund']);
  let liquid = 0;
  let illiquid = 0;
  for (const asset of flatAssets(plan)) {
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

/** Debt-to-asset ratio as a percentage */
export function debtRatio(plan: FinancialPlan): number {
  const assets = totalAssets(plan);
  if (assets === 0) return 0;
  return Math.round((totalLiabilities(plan) / assets) * 100);
}

/** All liability node IDs */
export function allLiabilityNodeIds(plan: FinancialPlan): string[] {
  return [
    ...plan.personalLiabilities.map((l) => l.id),
    ...plan.entities.flatMap((e) => e.liabilities.map((l) => l.id)),
  ];
}

/** % of wealth per entity — single-pass computation */
export function entityConcentration(plan: FinancialPlan): { name: string; pct: number }[] {
  const personalTotal = sumValues(plan.personalAssets);
  const entityTotals = plan.entities.map((e) => ({ name: e.name, total: sumValues(e.assets) }));
  const grandTotal = personalTotal + entityTotals.reduce((s, e) => s + e.total, 0);
  if (grandTotal === 0) return [];

  const result: { name: string; pct: number }[] = [];
  if (personalTotal > 0) result.push({ name: 'Personal', pct: Math.round((personalTotal / grandTotal) * 100) });
  for (const { name, total } of entityTotals) {
    if (total > 0) result.push({ name, pct: Math.round((total / grandTotal) * 100) });
  }
  return result.sort((a, b) => b.pct - a.pct);
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

const AUD_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

export function formatAUD(value: number): string {
  return AUD_FORMATTER.format(value);
}
