import { z } from 'zod';

export const AssetReturnOverrideSchema = z.object({
  assetId: z.string(),
  growthRate: z.number().describe('TOTAL annual return % (income + capital), e.g. 7.0'),
  incomeRate: z.number().optional().describe('Income portion of return % (rent, dividends, interest), e.g. 4.0'),
  reason: z.string().optional().describe('Why this rate was chosen'),
});

export const LiabilityOverrideSchema = z.object({
  liabilityId: z.string(),
  interestRate: z.number().describe('Annual interest rate %, e.g. 6.2'),
  remainingTermYears: z.number().describe('Remaining loan term in years'),
  reason: z.string().optional(),
});

export const ClientProjectionSettingsSchema = z.object({
  clientId: z.string(),
  retirementAge: z.number().describe('Expected retirement age'),
  salarySacrificeAmount: z.number().optional().describe('Annual pre-tax salary sacrifice to super, e.g. 10000'),
});

export const OngoingExpenseSchema = z.object({
  id: z.string().describe('Unique ID, format: exp-{short-name}'),
  name: z.string().describe('Display name, e.g. "Living Expenses"'),
  annualAmount: z.number().describe('Annual cost in dollars'),
  indexedToInflation: z.boolean().describe('Whether amount grows with inflation'),
});

export const LumpSumExpenseSchema = z.object({
  id: z.string().describe('Unique ID, format: lump-{short-name}'),
  name: z.string().describe('Display name, e.g. "Home Renovations"'),
  amount: z.number().describe('Total cost in dollars'),
  targetYear: z.number().describe('Year the expense occurs'),
});

export const ProjectionSettingsSchema = z.object({
  horizonYears: z.number().describe('Projection horizon in years'),
  inflationRate: z.number().describe('Annual inflation rate %'),
  salaryGrowthRate: z.number().describe('Annual salary growth rate %'),
  superContributionRate: z.number().describe('Employer super guarantee rate %'),
  superContributionsTaxRate: z.number().optional().describe('Tax on concessional super contributions %, e.g. 15'),
  superEarningsTaxRate: z.number().optional().describe('Tax on super accumulation earnings %, e.g. 15 (0 for pension)'),
  superPreservationAge: z.number().optional().describe('Age super can be accessed, default 60'),
  pprAssetIds: z.array(z.string()).optional().describe('Asset IDs tagged as primary residence'),
  retirementRiskProfile: z.enum(['conservative', 'moderately_conservative', 'balanced', 'growth', 'high_growth']).nullable().optional().describe('Risk profile to shift to at retirement'),
  concessionalCap: z.number().optional().describe('Max concessional super contributions p.a., default 30000'),
  div293Threshold: z.number().optional().describe('Div 293 income threshold, default 250000'),
  enableAgePension: z.boolean().optional().describe('Model simplified Age Pension income post-67'),
  frankingCreditRate: z.number().optional().describe('Company tax rate for franking credits %, default 30'),
  clients: z.array(ClientProjectionSettingsSchema),
  assetOverrides: z.array(AssetReturnOverrideSchema),
  liabilityOverrides: z.array(LiabilityOverrideSchema),
  ongoingExpenses: z.array(OngoingExpenseSchema).describe('Recurring annual expenses'),
  lumpSumExpenses: z.array(LumpSumExpenseSchema).describe('One-off expenses in specific years'),
});
