import type { FinancialPlan, ProjectionSettings, AssetType, RiskProfile, Asset } from 'shared/types';

/** Default TOTAL return rates by asset type and risk profile (income + capital growth) */
const GROWTH_RATES: Record<string, Record<string, number>> = {
  property:     { conservative: 5.0, moderately_conservative: 5.0, balanced: 5.5, growth: 6.0, high_growth: 6.0 },
  shares:       { conservative: 4.0, moderately_conservative: 5.5, balanced: 7.0, growth: 8.5, high_growth: 10.0 },
  managed_fund: { conservative: 4.0, moderately_conservative: 5.5, balanced: 7.0, growth: 8.5, high_growth: 10.0 },
  cash:         { conservative: 1.5, moderately_conservative: 1.5, balanced: 1.5, growth: 1.5, high_growth: 1.5 },
  super:        { conservative: 4.0, moderately_conservative: 5.5, balanced: 7.0, growth: 8.5, high_growth: 10.0 },
  pension:      { conservative: 4.0, moderately_conservative: 5.5, balanced: 7.0, growth: 8.5, high_growth: 10.0 },
  vehicle:      { conservative: -10, moderately_conservative: -10, balanced: -10, growth: -10, high_growth: -10 },
  other:        { conservative: 3.0, moderately_conservative: 3.0, balanced: 3.0, growth: 3.0, high_growth: 3.0 },
};

/** Default INCOME portion of total return — the rest is capital growth */
const DEFAULT_INCOME_RATES: Record<string, number> = {
  property: 4.0,      // rental yield
  shares: 3.0,        // dividend yield
  managed_fund: 2.5,  // distributions
  cash: 1.5,          // interest (100% income)
  super: 0,           // retained inside super wrapper
  pension: 0,         // retained inside pension wrapper
  vehicle: 0,
  other: 1.0,
};

/** Get the default total growth rate for an asset type given a risk profile */
export function defaultGrowthRate(assetType: AssetType, riskProfile: RiskProfile | null): number {
  const profile = riskProfile ?? 'balanced';
  return GROWTH_RATES[assetType]?.[profile] ?? 3.0;
}

/** Get the default income rate for an asset type */
export function defaultIncomeRate(assetType: AssetType): number {
  return DEFAULT_INCOME_RATES[assetType] ?? 0;
}

/** Shift risk profile down one notch for retirement */
const RISK_SHIFT: Record<string, RiskProfile> = {
  high_growth: 'growth',
  growth: 'balanced',
  balanced: 'moderately_conservative',
  moderately_conservative: 'conservative',
  conservative: 'conservative',
};

export function defaultRetirementRiskProfile(current: RiskProfile | null): RiskProfile {
  return RISK_SHIFT[current ?? 'balanced'] ?? 'moderately_conservative';
}

/** Guess which property is the primary residence (no rental yield indicators) */
function guessPPR(assets: Asset[]): string[] {
  const properties = assets.filter((a) => a.type === 'property');
  if (properties.length === 0) return [];
  if (properties.length === 1) return [properties[0].id];
  // If multiple properties, pick the one without rental/investment indicators in name or details
  const investmentPatterns = /\b(rental|investment|ip|commercial|tenant|lease)\b/i;
  const homePatterns = /\b(home|family|residence|principal|ppr|ppor)\b/i;
  const ppr = properties.find((p) => {
    const text = `${p.name} ${p.details ?? ''}`;
    return homePatterns.test(text) || !investmentPatterns.test(text);
  });
  return ppr ? [ppr.id] : [];
}

/** Build default projection settings from the financial plan */
export function getDefaultSettings(plan: FinancialPlan): ProjectionSettings {
  const riskProfile = plan.clients[0]?.riskProfile ?? 'balanced';

  // Horizon: project to age 90 for the youngest client (min 5 years)
  const ages = plan.clients.map((c) => c.age).filter((a): a is number => a !== null);
  const youngestAge = ages.length > 0 ? Math.min(...ages) : 45;
  const lifeExpectancy = 90;
  const horizonYears = Math.max(lifeExpectancy - youngestAge, 5);
  const retirementAge = 67;

  // Default living expenses: estimate from income if available
  const totalIncome = plan.clients.reduce((s, c) => s + (c.income ?? 0), 0);
  const estimatedLivingExpenses = totalIncome > 0 ? Math.round(totalIncome * 0.7) : 60000;

  // Auto-detect primary residence
  const allAssets = [
    ...plan.personalAssets,
    ...plan.entities.flatMap((e) => e.assets),
  ];
  const pprAssetIds = guessPPR(allAssets);

  return {
    horizonYears,
    inflationRate: 2.5,
    salaryGrowthRate: 3.0,
    superContributionRate: 11.5,
    superContributionsTaxRate: 15,
    superEarningsTaxRate: 15,
    superPreservationAge: 60,
    pprAssetIds,
    retirementRiskProfile: defaultRetirementRiskProfile(riskProfile),
    concessionalCap: 30000,
    div293Threshold: 250000,
    enableAgePension: true,
    frankingCreditRate: 30,
    clients: plan.clients.map((c) => ({
      clientId: c.id,
      retirementAge,
      salarySacrificeAmount: 0,
    })),
    assetOverrides: [],
    liabilityOverrides: [],
    ongoingExpenses: [
      { id: 'exp-living', name: 'Living Expenses', annualAmount: estimatedLivingExpenses, indexedToInflation: true },
    ],
    lumpSumExpenses: [],
  };
}

/** Resolve total growth rate for a specific asset — check overrides first, then defaults */
export function resolveGrowthRate(
  assetId: string,
  assetType: AssetType,
  settings: ProjectionSettings,
  riskProfile: RiskProfile | null,
): number {
  const override = settings.assetOverrides.find((o) => o.assetId === assetId);
  if (override) return override.growthRate;
  return defaultGrowthRate(assetType, riskProfile);
}

/** Resolve income rate for a specific asset — check overrides first, then defaults */
export function resolveIncomeRate(
  assetId: string,
  assetType: AssetType,
  settings: ProjectionSettings,
): number {
  const override = settings.assetOverrides.find((o) => o.assetId === assetId);
  if (override?.incomeRate !== undefined) return override.incomeRate;
  return defaultIncomeRate(assetType);
}

/** Resolve interest rate + term for a liability */
export function resolveLiabilityTerms(
  liabilityId: string,
  settings: ProjectionSettings,
  fallbackRate: number | null,
): { rate: number; termYears: number } {
  const override = settings.liabilityOverrides.find((o) => o.liabilityId === liabilityId);
  if (override) return { rate: override.interestRate, termYears: override.remainingTermYears };
  return { rate: fallbackRate ?? 6.0, termYears: 25 };
}
