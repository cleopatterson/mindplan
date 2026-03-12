import type {
  FinancialPlan, ProjectionSettings, ProjectionResult,
  ProjectionYearData, ProjectionMilestone, ProjectionAssetDetail,
  ProjectionLiabilityDetail, Asset, Liability,
  OngoingExpense, LumpSumExpense,
} from 'shared/types';
import { personalAssetsForCalc } from './calculations';
import { resolveGrowthRate, resolveIncomeRate, resolveLiabilityTerms, defaultGrowthRate, defaultIncomeRate } from './projectionDefaults';

/** Map asset types to projection chart categories */
function chartCategory(type: string): keyof Omit<ProjectionYearData, 'year' | 'liabilities' | 'netWorth' | 'income' | 'assetIncome' | 'expenses'> {
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
  growthRate: number;       // total return %
  incomeRate: number;       // income portion % (rent, dividends, interest)
  category: keyof Omit<ProjectionYearData, 'year' | 'liabilities' | 'netWorth' | 'income' | 'assetIncome' | 'expenses'>;
  isSuper: boolean;
  isPension: boolean;
  isPPR: boolean;           // primary residence — excluded from drawdown & income
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

/** Simplified Australian Age Pension (2025-26 rates, assets test only)
 * Assets test is typically the binding constraint for clients with significant assets.
 * Uses homeowner thresholds (PPR excluded from assessable assets). */
function calcAgePension(assessableAssets: number, isCouple: boolean): number {
  // 2025-26 rates (approximate, indexed to CPI)
  const maxPension = isCouple ? 43006 : 28514;  // per year, combined for couple
  const lowerThreshold = isCouple ? 470000 : 314000;  // homeowner
  const taperRate = 78; // $78 per year per $1,000 over threshold ($3/fortnight per $1,000)

  if (assessableAssets <= lowerThreshold) return maxPension;
  const reduction = Math.floor((assessableAssets - lowerThreshold) / 1000) * taperRate;
  return Math.max(0, maxPension - reduction);
}

/** Pure projection calculator */
export function calculateProjection(
  plan: FinancialPlan,
  settings: ProjectionSettings,
): ProjectionResult {
  const currentYear = new Date().getFullYear();
  const riskProfile = plan.clients[0]?.riskProfile ?? null;

  // Gather all assets (personal + entity)
  const allAssets: Asset[] = [
    ...personalAssetsForCalc(plan),
    ...plan.entities.flatMap((e) => e.assets),
  ];

  const pprIds = new Set(settings.pprAssetIds ?? []);

  const trackedAssets: TrackedAsset[] = allAssets.map((a) => {
    const startValue = a.value ?? 0;
    const isPPR = pprIds.has(a.id);
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      startValue,
      value: startValue,
      growthRate: resolveGrowthRate(a.id, a.type, settings, riskProfile),
      incomeRate: isPPR ? 0 : resolveIncomeRate(a.id, a.type, settings), // PPR has no rental income
      category: chartCategory(a.type),
      isSuper: a.type === 'super' || a.type === 'pension',
      isPension: a.type === 'pension',
      isPPR,
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

  // Super tax rates
  const superContribTaxRate = (settings.superContributionsTaxRate ?? 15) / 100;
  const superEarningsTaxRate = (settings.superEarningsTaxRate ?? 15) / 100;
  const concessionalCap = settings.concessionalCap ?? 30000;
  const div293Threshold = settings.div293Threshold ?? 250000;
  const frankingRate = (settings.frankingCreditRate ?? 30) / 100;

  // Per-client salary sacrifice
  const clientSalarySacrifice = plan.clients.map((c) => {
    const cs = settings.clients.find((s) => s.clientId === c.id);
    return { clientId: c.id, income: c.income ?? 0, sacrifice: cs?.salarySacrificeAmount ?? 0 };
  });

  // Compute total concessional contributions (SG + salary sacrifice), capped
  const totalGrossSG = totalIncome * (settings.superContributionRate / 100);
  const totalSalarySacrifice = clientSalarySacrifice.reduce((s, c) => s + c.sacrifice, 0);
  const totalConcessional = Math.min(totalGrossSG + totalSalarySacrifice, concessionalCap * plan.clients.length);

  // Div 293: extra 15% tax if income + concessional contributions > threshold (per client)
  const div293Extra = clientSalarySacrifice.reduce((total, c) => {
    const clientSG = c.income * (settings.superContributionRate / 100);
    const clientConcessional = Math.min(clientSG + c.sacrifice, concessionalCap);
    const testIncome = c.income + clientConcessional;
    if (testIncome > div293Threshold) {
      // Extra 15% applies to the lesser of: contributions, or amount exceeding threshold
      const excess = testIncome - div293Threshold;
      return total + Math.min(clientConcessional, excess) * 0.15;
    }
    return total;
  }, 0);

  // Net super contribution after 15% contributions tax + Div 293
  const contribTax = totalConcessional * superContribTaxRate + div293Extra;
  const annualSuperContrib = totalConcessional - contribTax;

  // Super preservation age — can't access super until this age
  const preservationAge = settings.superPreservationAge ?? 60;

  // Retirement risk profile shift
  const retirementRiskProfile = settings.retirementRiskProfile ?? null;
  let riskShiftApplied = false;

  // Expenditure settings (default to empty if missing for backward compat)
  const ongoingExpenses: OngoingExpense[] = settings.ongoingExpenses ?? [];
  const lumpSumExpenses: LumpSumExpense[] = settings.lumpSumExpenses ?? [];

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

      // Super preservation milestone (youngest reaches preservation age)
      const youngestLastYear = Math.min(...clientAges.map((ca) => ca.age + y - 1));
      const youngestThisYear = Math.min(...clientAges.map((ca) => ca.age + y));
      if (youngestLastYear < preservationAge && youngestThisYear >= preservationAge) {
        milestones.push({ year, label: `Super accessible (age ${preservationAge})` });
      }
    }

    // Are all clients retired?
    const allRetired = clientAges.every((ca) => ca.age + y >= ca.retirementAge);

    // Apply retirement risk profile shift (once, when all clients retired)
    if (allRetired && !riskShiftApplied && retirementRiskProfile) {
      riskShiftApplied = true;
      for (const a of trackedAssets) {
        // Only shift assets that don't have a manual override
        const hasOverride = settings.assetOverrides.some((o) => o.assetId === a.id);
        if (!hasOverride) {
          a.growthRate = defaultGrowthRate(a.type as any, retirementRiskProfile);
          if (!a.isSuper && !a.isPPR) {
            a.incomeRate = defaultIncomeRate(a.type as any);
          }
        }
      }
    }

    // Can clients access super this year? (youngest must be >= preservation age)
    const youngestAgeThisYear = Math.min(...clientAges.map((ca) => ca.age + y));
    const superAccessible = youngestAgeThisYear >= preservationAge;

    // Income for this year (grows with salary growth until retirement, minus salary sacrifice)
    const grossIncomeThisYear = allRetired
      ? 0
      : totalIncome * Math.pow(1 + settings.salaryGrowthRate / 100, y);
    const incomeThisYear = allRetired
      ? 0
      : grossIncomeThisYear - totalSalarySacrifice; // salary sacrifice is pre-tax

    // Calculate total expenses for this year
    let expensesThisYear = 0;

    // Ongoing expenses (indexed to inflation if configured)
    for (const exp of ongoingExpenses) {
      const inflationFactor = exp.indexedToInflation
        ? Math.pow(1 + settings.inflationRate / 100, y)
        : 1;
      expensesThisYear += exp.annualAmount * inflationFactor;
    }

    // Lump sum expenses in their target year
    for (const lump of lumpSumExpenses) {
      if (lump.targetYear === year) {
        expensesThisYear += lump.amount;
      }
    }

    // Loan repayments are also expenses
    const loanRepayments = trackedLiabilities.reduce((s, l) => s + (l.balance > 0 ? l.annualPayment : 0), 0);
    const totalExpenses = expensesThisYear + loanRepayments;

    // Grow assets — split into income + capital growth
    let assetIncomeThisYear = 0;
    if (y > 0) {
      for (const a of trackedAssets) {
        // Capital growth portion (total return minus income portion)
        const capitalRate = (a.growthRate - a.incomeRate) / 100;
        const incomeReturn = a.value * (a.incomeRate / 100);

        // Apply super earnings tax (15% for accumulation, 0% for pension) with franking credit offset
        if (a.isSuper) {
          const earningsTax = a.isPension ? 0 : superEarningsTaxRate;
          const totalReturn = a.value * (a.growthRate / 100);
          let taxOnEarnings = totalReturn * earningsTax;

          // Franking credit offset: assume ~40% of super earnings come from Australian equities
          // Franking credits offset tax at the company rate (30%)
          if (earningsTax > 0 && frankingRate > 0) {
            const equityPortion = 0.4; // typical balanced super fund allocation to Aust. shares
            const frankableIncome = totalReturn * equityPortion;
            const frankingCredit = frankableIncome * (frankingRate / (1 - frankingRate));
            taxOnEarnings = Math.max(0, taxOnEarnings - frankingCredit);
          }
          // In pension phase, franking credits generate a refund
          const frankingRefund = a.isPension ? totalReturn * 0.4 * (frankingRate / (1 - frankingRate)) : 0;
          a.value += totalReturn - taxOnEarnings + frankingRefund;
        } else {
          // Non-super: capital growth compounds in asset, income is distributed
          a.value *= (1 + capitalRate);
          assetIncomeThisYear += incomeReturn;
        }

        // Add super contributions if not yet retired (scaled with salary growth)
        if (a.isSuper && !allRetired) {
          const salaryFactor = Math.pow(1 + settings.salaryGrowthRate / 100, y);
          const scaledSuperContrib = annualSuperContrib * salaryFactor;
          const superAssets = trackedAssets.filter((ta) => ta.isSuper);
          const totalSuper = superAssets.reduce((s, ta) => s + ta.value, 0);
          if (totalSuper > 0) {
            a.value += scaledSuperContrib * (a.value / totalSuper);
          } else if (superAssets.length > 0) {
            a.value += scaledSuperContrib / superAssets.length;
          }
        }
        // Vehicles floor at 0
        if (a.type === 'vehicle') a.value = Math.max(0, a.value);
      }

      // Age Pension income (if enabled and all clients retired and >= 67)
      let agePensionThisYear = 0;
      if ((settings.enableAgePension ?? true) && allRetired) {
        const allAge67Plus = clientAges.every((ca) => ca.age + y >= 67);
        if (allAge67Plus) {
          // Assessable assets = all non-PPR assets (super included once preservation age reached)
          const assessable = trackedAssets
            .filter((a) => !a.isPPR && (!a.isSuper || superAccessible))
            .reduce((s, a) => s + Math.max(0, a.value), 0);
          const isCouple = plan.clients.length >= 2;
          agePensionThisYear = calcAgePension(assessable, isCouple);
        }
      }

      // Cash flow: employment income + asset income + Age Pension minus expenses
      const netCashFlow = incomeThisYear + assetIncomeThisYear + agePensionThisYear - expensesThisYear;

      if (allRetired) {
        // Post-retirement: drawdown waterfall (respects preservation age + PPR)
        const deficit = -netCashFlow; // positive = need to withdraw
        if (deficit > 0) {
          let remaining = deficit;

          // Draw from super/pension first (only if preservation age reached)
          if (superAccessible) {
            const superAssets = trackedAssets.filter((a) => a.isSuper && a.value > 0);
            const totalSuper = superAssets.reduce((s, a) => s + a.value, 0);
            if (totalSuper > 0) {
              const superDraw = Math.min(remaining, totalSuper);
              for (const a of superAssets) {
                const share = totalSuper > 0 ? a.value / totalSuper : 1 / superAssets.length;
                a.value -= superDraw * share;
                a.value = Math.max(0, a.value);
              }
              remaining -= superDraw;
            }
          }

          // Then draw from cash (excluding PPR)
          if (remaining > 0) {
            const cashAssets = trackedAssets.filter((a) => a.category === 'cash' && !a.isPPR && a.value > 0);
            const totalCash = cashAssets.reduce((s, a) => s + a.value, 0);
            if (totalCash > 0) {
              const cashDraw = Math.min(remaining, totalCash);
              for (const a of cashAssets) {
                const share = a.value / totalCash;
                a.value -= cashDraw * share;
                a.value = Math.max(0, a.value);
              }
              remaining -= cashDraw;
            }
          }

          // Then other liquid assets — shares, managed funds (excluding PPR)
          if (remaining > 0) {
            const liquidAssets = trackedAssets.filter((a) =>
              (a.category === 'shares' || a.category === 'other') && !a.isPPR && a.value > 0,
            );
            const totalLiquid = liquidAssets.reduce((s, a) => s + a.value, 0);
            if (totalLiquid > 0) {
              const liquidDraw = Math.min(remaining, totalLiquid);
              for (const a of liquidAssets) {
                const share = a.value / totalLiquid;
                a.value -= liquidDraw * share;
                a.value = Math.max(0, a.value);
              }
              remaining -= liquidDraw;
            }
          }

          // Last resort: super before preservation age (if still locked out)
          if (remaining > 0 && !superAccessible) {
            // Can't access super yet — deficit remains unfunded
            // (assets go negative naturally if cash/liquid exhausted)
          }
        }
      } else {
        // Pre-retirement: surplus income adds to cash savings
        if (netCashFlow > 0) {
          const cashAssets = trackedAssets.filter((a) => a.category === 'cash');
          if (cashAssets.length > 0) {
            const perAsset = netCashFlow / cashAssets.length;
            for (const a of cashAssets) a.value += perAsset;
          } else {
            // No cash asset — add surplus to first non-super asset or create virtual cash
            const nonSuper = trackedAssets.find((a) => !a.isSuper && a.category !== 'vehicle');
            if (nonSuper) nonSuper.value += netCashFlow;
          }
        } else if (netCashFlow < 0) {
          // Expenses exceed income pre-retirement — draw from cash
          let deficit = -netCashFlow;
          const cashAssets = trackedAssets.filter((a) => a.category === 'cash' && a.value > 0);
          const totalCash = cashAssets.reduce((s, a) => s + a.value, 0);
          if (totalCash > 0) {
            const draw = Math.min(deficit, totalCash);
            for (const a of cashAssets) {
              const share = a.value / totalCash;
              a.value -= draw * share;
              a.value = Math.max(0, a.value);
            }
          }
        }
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
      assetIncome: Math.round(assetIncomeThisYear),
      expenses: Math.round(totalExpenses),
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
