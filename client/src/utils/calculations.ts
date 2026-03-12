import type { FinancialPlan, Asset, Liability, Entity } from 'shared/types';

/** True when at least one SMSF entity has its own underlying assets */
function hasSmsfWithAssets(plan: FinancialPlan): boolean {
  return plan.entities.some((e) => e.type === 'smsf' && e.assets.length > 0);
}

/**
 * Personal assets for financial calculations. Excludes type:'super' when an
 * SMSF entity holds its own underlying assets, because the personal super/
 * pension balances are member-account views of the same money.
 */
export function personalAssetsForCalc(plan: FinancialPlan): Asset[] {
  if (hasSmsfWithAssets(plan)) {
    return plan.personalAssets.filter((a) => a.type !== 'super' && a.type !== 'pension');
  }
  return plan.personalAssets;
}

/** Flatten all assets across personal + entities for calculations (deduped) */
function flatAssets(plan: FinancialPlan): Asset[] {
  const result = [...personalAssetsForCalc(plan)];
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

/** Sum of all asset values across all entities + personal (SMSF-deduped) */
export function totalAssets(plan: FinancialPlan): number {
  return sumValues(personalAssetsForCalc(plan)) + plan.entities.reduce((s, e) => s + sumValues(e.assets), 0);
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
export const ASSET_GROUP: Record<string, string> = {
  property: 'Property',
  shares: 'Shares',
  managed_fund: 'Shares',   // managed funds grouped with shares
  cash: 'Cash',
  super: 'Super',
  pension: 'Super',          // pension grouped with super for summary bar
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

/** % of wealth per entity — single-pass computation (SMSF-deduped) */
export function entityConcentration(plan: FinancialPlan): { name: string; pct: number }[] {
  const personalTotal = sumValues(personalAssetsForCalc(plan));
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

// ── Enriched helpers for summary detail panels ──

export interface AllocationItem { group: string; value: number; pct: number }

/** Asset allocation with dollar amounts and percentages, sorted descending */
export function assetAllocationDetailed(plan: FinancialPlan): AllocationItem[] {
  const byGroup: Record<string, number> = {};
  for (const asset of flatAssets(plan)) {
    const group = ASSET_GROUP[asset.type] ?? 'Other';
    byGroup[group] = (byGroup[group] || 0) + (asset.value || 0);
  }
  const total = Object.values(byGroup).reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return Object.entries(byGroup)
    .map(([group, value]) => ({ group, value, pct: Math.round((value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

export interface LiquidityItem { name: string; value: number; owner: string }
export interface LiquidityDetailed {
  liquidTotal: number;
  illiquidTotal: number;
  liquidPct: number;
  illiquidPct: number;
  liquidAssets: LiquidityItem[];
  illiquidAssets: LiquidityItem[];
}

/** Liquidity breakdown with per-asset lists and owner names (SMSF-deduped) */
export function liquidityBreakdownDetailed(plan: FinancialPlan): LiquidityDetailed {
  const liquidTypes = new Set(['cash', 'shares', 'managed_fund']);
  const liquidAssets: LiquidityItem[] = [];
  const illiquidAssets: LiquidityItem[] = [];

  // Personal assets (excluding duplicated super when SMSF has underlying assets)
  for (const a of personalAssetsForCalc(plan)) {
    const item = { name: a.name, value: a.value || 0, owner: 'Personal' };
    if (liquidTypes.has(a.type)) liquidAssets.push(item);
    else illiquidAssets.push(item);
  }
  // Entity assets
  for (const entity of plan.entities) {
    for (const a of entity.assets) {
      const item = { name: a.name, value: a.value || 0, owner: entity.name };
      if (liquidTypes.has(a.type)) liquidAssets.push(item);
      else illiquidAssets.push(item);
    }
  }

  liquidAssets.sort((a, b) => b.value - a.value);
  illiquidAssets.sort((a, b) => b.value - a.value);

  const liquidTotal = liquidAssets.reduce((s, a) => s + a.value, 0);
  const illiquidTotal = illiquidAssets.reduce((s, a) => s + a.value, 0);
  const total = liquidTotal + illiquidTotal;

  return {
    liquidTotal,
    illiquidTotal,
    liquidPct: total > 0 ? Math.round((liquidTotal / total) * 100) : 0,
    illiquidPct: total > 0 ? Math.round((illiquidTotal / total) * 100) : 0,
    liquidAssets,
    illiquidAssets,
  };
}

export interface LiabilityItem { name: string; amount: number; interestRate: number | null; owner: string; type: string }

/** All liabilities sorted by amount, with owner names */
export function allLiabilitiesDetailed(plan: FinancialPlan): LiabilityItem[] {
  const items: LiabilityItem[] = [];
  for (const l of plan.personalLiabilities) {
    items.push({ name: l.name, amount: l.amount || 0, interestRate: l.interestRate, owner: 'Personal', type: l.type });
  }
  for (const entity of plan.entities) {
    for (const l of entity.liabilities) {
      items.push({ name: l.name, amount: l.amount || 0, interestRate: l.interestRate, owner: entity.name, type: l.type });
    }
  }
  return items.sort((a, b) => b.amount - a.amount);
}

export interface ConcentrationItem { name: string; value: number; pct: number }

/** Per-entity dollar values and percentages (SMSF-deduped) */
export function entityConcentrationDetailed(plan: FinancialPlan): ConcentrationItem[] {
  const personalTotal = sumValues(personalAssetsForCalc(plan));
  const entityTotals = plan.entities.map((e) => ({ name: e.name, total: sumValues(e.assets) }));
  const grandTotal = personalTotal + entityTotals.reduce((s, e) => s + e.total, 0);
  if (grandTotal === 0) return [];

  const result: ConcentrationItem[] = [];
  if (personalTotal > 0) result.push({ name: 'Personal', value: personalTotal, pct: Math.round((personalTotal / grandTotal) * 100) });
  for (const { name, total } of entityTotals) {
    if (total > 0) result.push({ name, value: total, pct: Math.round((total / grandTotal) * 100) });
  }
  return result.sort((a, b) => b.value - a.value);
}

/** Count of assets missing a value */
export function unvaluedAssetStats(plan: FinancialPlan): { unvalued: number; total: number; pct: number } {
  const all = flatAssets(plan);
  const unvalued = all.filter((a) => a.value === null).length;
  return { unvalued, total: all.length, pct: all.length > 0 ? Math.round((unvalued / all.length) * 100) : 0 };
}

const AUD_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

export function formatAUD(value: number): string {
  return AUD_FORMATTER.format(value);
}
