import { z } from 'zod';

export const AssetSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "asset-1"'),
  name: z.string().describe('Asset name, e.g. "123 Smith St, Bondi"'),
  type: z.enum(['property', 'shares', 'cash', 'managed_fund', 'super', 'insurance', 'vehicle', 'other']),
  value: z.nullable(z.number()).describe('Current value in AUD, null if unknown'),
  details: z.nullable(z.string()).describe('Additional details'),
});

export const LiabilitySchema = z.object({
  id: z.string().describe('Unique ID, e.g. "liability-1"'),
  name: z.string().describe('Liability name, e.g. "ANZ Mortgage - 123 Smith St"'),
  type: z.enum(['mortgage', 'loan', 'credit_card', 'other']),
  amount: z.nullable(z.number()).describe('Outstanding balance in AUD, null if unknown'),
  interestRate: z.nullable(z.number()).describe('Annual interest rate as percentage, null if unknown'),
  details: z.nullable(z.string()).describe('Additional details'),
});

export const ClientSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "client-1"'),
  name: z.string(),
  age: z.nullable(z.number()),
  occupation: z.nullable(z.string()),
  income: z.nullable(z.number()).describe('Annual income in AUD'),
  superBalance: z.nullable(z.number()).describe('Superannuation balance in AUD'),
});

export const EntitySchema = z.object({
  id: z.string().describe('Unique ID, e.g. "entity-1"'),
  name: z.string().describe('Entity name, e.g. "Wall Family Trust"'),
  type: z.enum(['trust', 'smsf', 'company', 'partnership']),
  linkedClientIds: z.array(z.string()).describe('Client IDs linked as trustees/directors/beneficiaries'),
  role: z.nullable(z.string()).describe('Role description, e.g. "Trustee & Beneficiary"'),
  assets: z.array(AssetSchema),
  liabilities: z.array(LiabilitySchema),
});

export const DataGapSchema = z.object({
  entityId: z.nullable(z.string()).describe('Related entity ID, or null for personal gaps'),
  field: z.string().describe('Field name that is missing'),
  description: z.string().describe('Human-readable description of what is needed'),
});

export const FinancialPlanSchema = z.object({
  clients: z.array(ClientSchema),
  entities: z.array(EntitySchema),
  personalAssets: z.array(AssetSchema).describe('Assets held personally, not in entities'),
  personalLiabilities: z.array(LiabilitySchema).describe('Liabilities held personally'),
  objectives: z.array(z.string()).describe('Financial objectives mentioned in the document'),
  dataGaps: z.array(DataGapSchema).describe('Information that appears missing or unclear'),
});
