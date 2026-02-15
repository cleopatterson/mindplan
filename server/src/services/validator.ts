import type { FinancialPlan, DataGap } from 'shared/types';

/**
 * Scans the parsed financial plan for null values and enriches the dataGaps array
 * with automatically detected missing information.
 */
export function enrichGaps(plan: FinancialPlan): void {
  const autoGaps: DataGap[] = [];

  for (const client of plan.clients) {
    if (client.age === null) {
      autoGaps.push({ entityId: null, field: 'age', description: `Age missing for ${client.name}` });
    }
    if (client.income === null) {
      autoGaps.push({ entityId: null, field: 'income', description: `Income missing for ${client.name}` });
    }
    if (client.superBalance === null) {
      autoGaps.push({ entityId: null, field: 'superBalance', description: `Super balance missing for ${client.name}` });
    }
  }

  for (const entity of plan.entities) {
    for (const asset of entity.assets) {
      if (asset.value === null) {
        autoGaps.push({
          entityId: entity.id,
          field: 'value',
          description: `Value missing for "${asset.name}" in ${entity.name}`,
        });
      }
    }
    for (const liability of entity.liabilities) {
      if (liability.amount === null) {
        autoGaps.push({
          entityId: entity.id,
          field: 'amount',
          description: `Outstanding balance missing for "${liability.name}" in ${entity.name}`,
        });
      }
    }
  }

  for (const asset of plan.personalAssets) {
    if (asset.value === null) {
      autoGaps.push({ entityId: null, field: 'value', description: `Value missing for personal asset "${asset.name}"` });
    }
  }

  // Merge with Claude-detected gaps, avoiding duplicates
  const existingDescs = new Set(plan.dataGaps.map((g) => g.description));
  for (const gap of autoGaps) {
    if (!existingDescs.has(gap.description)) {
      plan.dataGaps.push(gap);
    }
  }
}
