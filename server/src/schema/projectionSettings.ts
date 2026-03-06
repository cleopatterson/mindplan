import { z } from 'zod';

export const AssetReturnOverrideSchema = z.object({
  assetId: z.string(),
  growthRate: z.number().describe('Annual growth rate %, e.g. 7.0'),
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
});

export const ProjectionSettingsSchema = z.object({
  horizonYears: z.number().describe('Projection horizon in years'),
  inflationRate: z.number().describe('Annual inflation rate %'),
  salaryGrowthRate: z.number().describe('Annual salary growth rate %'),
  superContributionRate: z.number().describe('Employer super guarantee rate %'),
  clients: z.array(ClientProjectionSettingsSchema),
  assetOverrides: z.array(AssetReturnOverrideSchema),
  liabilityOverrides: z.array(LiabilityOverrideSchema),
});
