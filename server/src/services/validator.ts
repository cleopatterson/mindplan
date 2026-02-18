import type { FinancialPlan, DataGap } from 'shared/types';

/**
 * Scans the parsed financial plan for critical missing data and enriches
 * the dataGaps array. Only flags high-priority gaps that affect key metrics
 * (net worth, debt ratio, planning timeline).
 */
export function enrichGaps(plan: FinancialPlan): void {
  const autoGaps: DataGap[] = [];

  // Client age — critical for retirement/insurance planning
  for (const client of plan.clients) {
    if (client.age === null) {
      autoGaps.push({ entityId: null, field: 'age', description: `Age missing for ${client.name}`, nodeId: client.id });
    }
  }

  // Asset values — critical for net worth and allocation
  for (const asset of plan.personalAssets) {
    if (asset.value === null) {
      autoGaps.push({ entityId: null, field: 'value', description: `Value missing for "${asset.name}"`, nodeId: asset.id });
    }
  }
  for (const entity of plan.entities) {
    for (const asset of entity.assets) {
      if (asset.value === null) {
        autoGaps.push({
          entityId: entity.id,
          field: 'value',
          description: `Value missing for "${asset.name}" in ${entity.name}`,
          nodeId: asset.id,
        });
      }
    }

    // Liability amounts — critical for net worth and debt ratio
    for (const liability of entity.liabilities) {
      if (liability.amount === null) {
        autoGaps.push({
          entityId: entity.id,
          field: 'amount',
          description: `Balance missing for "${liability.name}" in ${entity.name}`,
          nodeId: liability.id,
        });
      }
    }
  }

  for (const liability of plan.personalLiabilities) {
    if (liability.amount === null) {
      autoGaps.push({ entityId: null, field: 'amount', description: `Balance missing for "${liability.name}"`, nodeId: liability.id });
    }
  }

  // Merge with Claude-detected gaps, avoiding duplicates (keyed on nodeId+field when possible)
  const existingKeys = new Set(
    plan.dataGaps.map((g) => g.nodeId ? `${g.nodeId}::${g.field}` : g.description),
  );
  for (const gap of autoGaps) {
    const key = gap.nodeId ? `${gap.nodeId}::${gap.field}` : gap.description;
    if (!existingKeys.has(key)) {
      plan.dataGaps.push(gap);
    }
  }
}
