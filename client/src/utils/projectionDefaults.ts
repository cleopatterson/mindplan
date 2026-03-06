import type { FinancialPlan, ProjectionSettings, AssetType, RiskProfile } from 'shared/types';

/** Default growth rates by asset type and risk profile */
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

/** Get the default growth rate for an asset type given a risk profile */
export function defaultGrowthRate(assetType: AssetType, riskProfile: RiskProfile | null): number {
  const profile = riskProfile ?? 'balanced';
  return GROWTH_RATES[assetType]?.[profile] ?? 3.0;
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

  return {
    horizonYears,
    inflationRate: 2.5,
    salaryGrowthRate: 3.0,
    superContributionRate: 11.5,
    clients: plan.clients.map((c) => ({
      clientId: c.id,
      retirementAge,
    })),
    assetOverrides: [],
    liabilityOverrides: [],
  };
}

/** Resolve growth rate for a specific asset — check overrides first, then defaults */
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
