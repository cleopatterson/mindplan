import type { FinancialPlan, DataGap } from 'shared/types';

/**
 * Scans the parsed financial plan for null values and enriches the dataGaps array
 * with automatically detected missing information.
 */
export function enrichGaps(plan: FinancialPlan): void {
  const autoGaps: DataGap[] = [];

  for (const client of plan.clients) {
    if (client.age === null) {
      autoGaps.push({ entityId: null, field: 'age', description: `Age missing for ${client.name}`, nodeId: client.id });
    }
    if (client.income === null) {
      autoGaps.push({ entityId: null, field: 'income', description: `Income missing for ${client.name}`, nodeId: client.id });
    }
    if (client.superBalance === null) {
      autoGaps.push({ entityId: null, field: 'superBalance', description: `Super balance missing for ${client.name}`, nodeId: client.id });
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
    for (const liability of entity.liabilities) {
      if (liability.amount === null) {
        autoGaps.push({
          entityId: entity.id,
          field: 'amount',
          description: `Outstanding balance missing for "${liability.name}" in ${entity.name}`,
          nodeId: liability.id,
        });
      }
    }
  }

  for (const asset of plan.personalAssets) {
    if (asset.value === null) {
      autoGaps.push({ entityId: null, field: 'value', description: `Value missing for personal asset "${asset.name}"`, nodeId: asset.id });
    }
  }

  // Estate planning gaps
  for (const item of plan.estatePlanning ?? []) {
    const clientName = plan.clients.find((c) => c.id === item.clientId)?.name ?? item.clientId;
    const typeLabel = item.type === 'poa' ? 'Power of Attorney'
      : item.type === 'super_nomination' ? 'Super Nomination'
      : item.type.charAt(0).toUpperCase() + item.type.slice(1);

    if (item.status === null) {
      autoGaps.push({ entityId: null, field: 'status', description: `Status unknown for ${clientName}'s ${typeLabel}`, nodeId: item.id });
    }
    if (item.status === 'expired') {
      autoGaps.push({ entityId: null, field: 'status', description: `${clientName}'s ${typeLabel} is expired — needs review`, nodeId: item.id });
    }
    if (item.status === 'not_established') {
      autoGaps.push({ entityId: null, field: 'status', description: `${clientName} has no ${typeLabel} established`, nodeId: item.id });
    }
    if (item.primaryPerson === null && item.status !== 'not_established') {
      autoGaps.push({ entityId: null, field: 'primaryPerson', description: `Primary person missing for ${clientName}'s ${typeLabel}`, nodeId: item.id });
    }
  }

  // Family member gaps (children + grandchildren)
  for (const member of plan.familyMembers ?? []) {
    if (member.isDependant && member.age === null) {
      autoGaps.push({ entityId: null, field: 'age', description: `Age missing for dependant ${member.name}`, nodeId: member.id });
    }
    for (const grandchild of member.children ?? []) {
      if (grandchild.isDependant && grandchild.age === null) {
        autoGaps.push({ entityId: null, field: 'age', description: `Age missing for dependant ${grandchild.name}`, nodeId: grandchild.id });
      }
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
