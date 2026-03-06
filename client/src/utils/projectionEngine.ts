import type {
  FinancialPlan, ProjectionSettings, ProjectionResult,
  ProjectionYearData, ProjectionMilestone, ProjectionAssetDetail,
  ProjectionLiabilityDetail, Asset, Liability,
} from 'shared/types';
import { personalAssetsForCalc } from './calculations';
import { resolveGrowthRate, resolveLiabilityTerms } from './projectionDefaults';

/** Map asset types to projection chart categories */
function chartCategory(type: string): keyof Omit<ProjectionYearData, 'year' | 'liabilities' | 'netWorth' | 'income'> {
  switch (type) {
    case 'property': return 'property';
    case 'shares':
    case 'managed_fund': return 'shares';
    case 'super':
    case 'pension': return 'super';
    case 'cash': return 'cash';
    case 'vehicle': return 'vehicle';
    default: return 'other';
  }
}

interface TrackedAsset {
  id: string;
  name: string;
  type: string;
  startValue: number;
  value: number;
  growthRate: number;
  category: keyof Omit<ProjectionYearData, 'year' | 'liabilities' | 'netWorth' | 'income'>;
  isSuper: boolean;
}

interface TrackedLiability {
  id: string;
  name: string;
  type: string;
  startBalance: number;
  balance: number;
  rate: number;
  termYears: number;
  annualPayment: number;
  paidOffYear: number | null;
}

/** Calculate P&I annual payment */
function annualPayment(principal: number, annualRate: number, termYears: number): number {
  if (annualRate === 0) return termYears > 0 ? principal / termYears : principal;
  const r = annualRate / 100;
  return (principal * r) / (1 - Math.pow(1 + r, -termYears));
}

/** Pure projection calculator */
export function calculateProjection(
  plan: FinancialPlan,
  settings: ProjectionSettings,
): ProjectionResult {
  const currentYear = new Date().getFullYear();
  const riskProfile = plan.clients[0]?.riskProfile ?? null;

  // Gather all assets (personal + entity), excluding insurance
  const allAssets: Asset[] = [
    ...personalAssetsForCalc(plan),
    ...plan.entities.flatMap((e) => e.assets),
  ].filter((a) => a.type !== 'insurance');

  const trackedAssets: TrackedAsset[] = allAssets.map((a) => {
    const startValue = a.value ?? 0;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      startValue,
      value: startValue,
      growthRate: resolveGrowthRate(a.id, a.type, settings, riskProfile),
      category: chartCategory(a.type),
      isSuper: a.type === 'super' || a.type === 'pension',
    };
  });

  // Gather all liabilities
  const allLiabilities: Liability[] = [
    ...plan.personalLiabilities,
    ...plan.entities.flatMap((e) => e.liabilities),
  ];

  const trackedLiabilities: TrackedLiability[] = allLiabilities.map((l) => {
    const { rate, termYears } = resolveLiabilityTerms(l.id, settings, l.interestRate);
    const balance = l.amount ?? 0;
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      startBalance: balance,
      balance,
      rate,
      termYears,
      annualPayment: balance > 0 ? annualPayment(balance, rate, termYears) : 0,
      paidOffYear: balance <= 0 ? currentYear : null,
    };
  });

  // Client income + retirement info
  const totalIncome = plan.clients.reduce((s, c) => s + (c.income ?? 0), 0);
  const clientAges = plan.clients.map((c) => ({
    clientId: c.id,
    age: c.age ?? 45,
    retirementAge: settings.clients.find((cs: { clientId: string }) => cs.clientId === c.id)?.retirementAge ?? 67,
    name: c.name,
  }));

  // Annual super contribution (employer SG on total income)
  const annualSuperContrib = totalIncome * (settings.superContributionRate / 100);

  const yearData: ProjectionYearData[] = [];
  const milestones: ProjectionMilestone[] = [];
  let debtFreeYear: number | null = null;

  for (let y = 0; y <= settings.horizonYears; y++) {
    const year = currentYear + y;

    // Check retirements this year — group clients retiring in the same year
    if (y > 0) {
      const retiringThisYear = clientAges.filter((ca) => ca.age + y === ca.retirementAge);
      if (retiringThisYear.length > 0) {
        if (retiringThisYear.length === clientAges.length && clientAges.length > 1) {
          milestones.push({ year, label: `Both retire at ${retiringThisYear[0].retirementAge}` });
        } else {
          for (const ca of retiringThisYear) {
            const firstName = ca.name.split(' ')[0];
            milestones.push({ year, label: `${firstName} retires at ${ca.retirementAge}` });
          }
        }
      }
    }

    // Are all clients retired?
    const allRetired = clientAges.every((ca) => ca.age + y >= ca.retirementAge);

    // Income for this year (grows with salary growth until retirement)
    const incomeThisYear = allRetired
      ? 0
      : totalIncome * Math.pow(1 + settings.salaryGrowthRate / 100, y);

    // Grow assets
    if (y > 0) {
      for (const a of trackedAssets) {
        a.value *= (1 + a.growthRate / 100);
        // Add super contributions if not yet retired and this is a super asset
        if (a.isSuper && !allRetired) {
          const superAssets = trackedAssets.filter((ta) => ta.isSuper);
          const totalSuper = superAssets.reduce((s, ta) => s + ta.value, 0);
          if (totalSuper > 0) {
            a.value += annualSuperContrib * (a.value / totalSuper);
          } else if (superAssets.length > 0) {
            a.value += annualSuperContrib / superAssets.length;
          }
        }
        // Vehicles floor at 0
        if (a.type === 'vehicle') a.value = Math.max(0, a.value);
      }
    }

    // Pay down liabilities
    if (y > 0) {
      for (const l of trackedLiabilities) {
        if (l.balance <= 0) continue;
        const interest = l.balance * (l.rate / 100);
        const principal = Math.min(l.annualPayment - interest, l.balance);
        l.balance = Math.max(0, l.balance - principal);
        if (l.balance <= 0 && l.paidOffYear === null) {
          l.paidOffYear = year;
        }
      }
    }

    // Check if debt-free this year
    const totalDebt = trackedLiabilities.reduce((s, l) => s + l.balance, 0);
    if (totalDebt <= 0 && debtFreeYear === null && allLiabilities.length > 0) {
      debtFreeYear = year;
      if (y > 0) {
        milestones.push({ year, label: 'Debt free' });
      }
    }

    // Aggregate by category
    const row: ProjectionYearData = {
      year,
      property: 0, shares: 0, super: 0, cash: 0, vehicle: 0, other: 0,
      liabilities: 0, netWorth: 0, income: Math.round(incomeThisYear),
    };

    for (const a of trackedAssets) {
      row[a.category] += Math.round(a.value);
    }
    row.liabilities = -Math.round(totalDebt);
    row.netWorth = row.property + row.shares + row.super + row.cash + row.vehicle + row.other + row.liabilities;

    yearData.push(row);
  }

  // Detect retirement year for summary
  const retirementYear = clientAges.length > 0
    ? currentYear + Math.max(...clientAges.map((ca) => ca.retirementAge - ca.age))
    : null;
  const retirementRow = retirementYear ? yearData.find((r) => r.year === retirementYear) : null;

  // Add goal-based milestones
  for (const goal of plan.goals ?? []) {
    if (goal.timeframe) {
      const match = goal.timeframe.match(/(\d+)\s*year/i);
      if (match) {
        const goalYear = currentYear + parseInt(match[1]);
        if (goalYear <= currentYear + settings.horizonYears) {
          milestones.push({ year: goalYear, label: goal.name });
        }
      }
    }
  }

  milestones.sort((a, b) => a.year - b.year);

  // Build detail breakdowns
  const assetDetails: ProjectionAssetDetail[] = trackedAssets.map((a) => ({
    name: a.name,
    type: a.type,
    startValue: a.startValue,
    endValue: Math.round(a.value),
    growthRate: a.growthRate,
  }));

  const liabilityDetails: ProjectionLiabilityDetail[] = trackedLiabilities.map((l) => ({
    name: l.name,
    type: l.type,
    startBalance: l.startBalance,
    endBalance: Math.round(l.balance),
    interestRate: l.rate,
    termYears: l.termYears,
    annualPayment: Math.round(l.annualPayment),
    paidOffYear: l.paidOffYear,
  }));

  return {
    yearData,
    milestones,
    netWorthAtRetirement: retirementRow?.netWorth ?? null,
    superAtRetirement: retirementRow?.super ?? null,
    yearsUntilDebtFree: debtFreeYear !== null ? debtFreeYear - currentYear : null,
    assetDetails,
    liabilityDetails,
    retirementYear,
  };
}
