import { z } from 'zod';

export const AssetSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "asset-1"'),
  name: z.string().describe('Asset name, e.g. "123 Smith St, Bondi"'),
  type: z.enum(['property', 'shares', 'cash', 'managed_fund', 'super', 'pension', 'insurance', 'vehicle', 'other']),
  value: z.nullable(z.number()).describe('Current value in AUD, null if unknown'),
  ownerIds: z.array(z.string()).default([]).describe('Client IDs who own this asset. For personal assets: e.g. ["client-1","client-2"] if joint, ["client-1"] if sole. Empty for entity assets.'),
  details: z.nullable(z.string()).describe('Additional details'),
});

export const LiabilitySchema = z.object({
  id: z.string().describe('Unique ID, e.g. "liability-1"'),
  name: z.string().describe('Liability name, e.g. "ANZ Mortgage - 123 Smith St"'),
  type: z.enum(['mortgage', 'loan', 'credit_card', 'other']),
  amount: z.nullable(z.number()).describe('Outstanding balance in AUD, null if unknown'),
  interestRate: z.nullable(z.number()).describe('Annual interest rate as percentage, null if unknown'),
  ownerIds: z.array(z.string()).default([]).describe('Client IDs responsible for this liability. e.g. ["client-1","client-2"] if joint. Empty for entity liabilities.'),
  details: z.nullable(z.string()).describe('Additional details'),
});

export const ClientSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "client-1"'),
  name: z.string(),
  age: z.nullable(z.number()),
  occupation: z.nullable(z.string()),
  income: z.nullable(z.number()).describe('Annual income in AUD'),
  superBalance: z.nullable(z.number()).describe('Superannuation balance in AUD'),
  riskProfile: z.nullable(z.enum(['conservative', 'moderately_conservative', 'balanced', 'growth', 'high_growth'])).default(null).describe('Investment risk profile assessment, null if not specified'),
});

export const EntitySchema = z.object({
  id: z.string().describe('Unique ID, e.g. "entity-1"'),
  name: z.string().describe('Entity name, e.g. "Wall Family Trust"'),
  type: z.enum(['trust', 'smsf', 'company', 'partnership']),
  linkedClientIds: z.array(z.string()).describe('Client IDs linked as trustees/directors/beneficiaries'),
  role: z.nullable(z.string()).describe('Role description, e.g. "Trustee & Beneficiary"'),
  trusteeName: z.nullable(z.string()).default(null).describe('Trustee name, e.g. "Tony Wall" or "Smith Corp Pty Ltd"'),
  trusteeType: z.nullable(z.enum(['individual', 'corporate'])).default(null).describe('Whether trustee is an individual or corporate entity (Pty Ltd)'),
  assets: z.array(AssetSchema),
  liabilities: z.array(LiabilitySchema),
});

export const EstatePlanItemSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "estate-1"'),
  clientId: z.string().describe('Client ID this estate document belongs to'),
  type: z.enum(['will', 'poa', 'guardianship', 'super_nomination']),
  status: z.nullable(z.enum(['current', 'expired', 'not_established'])).describe('Document status'),
  lastReviewed: z.nullable(z.number()).describe('Year last reviewed, e.g. 2021'),
  primaryPerson: z.nullable(z.string()).describe('Executor, attorney, or guardian name'),
  alternatePeople: z.nullable(z.array(z.string())).describe('Alternate executor/attorney/guardian names'),
  details: z.nullable(z.string()),
  hasIssue: z.boolean().describe('True if expired, not established, or missing key information'),
});

export const GrandchildSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "grandchild-1"'),
  name: z.string(),
  relationship: z.enum(['grandson', 'granddaughter']),
  age: z.nullable(z.number()),
  isDependant: z.boolean().describe('True if a financial dependant'),
  details: z.nullable(z.string()),
});

export const FamilyMemberSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "family-1"'),
  name: z.string().describe('Direct child name (son/daughter)'),
  relationship: z.enum(['son', 'daughter', 'other']),
  partner: z.nullable(z.string()).describe('Spouse/partner name, null if unmarried'),
  age: z.nullable(z.number()),
  isDependant: z.boolean().describe('True if a financial dependant'),
  details: z.nullable(z.string()),
  children: z.array(GrandchildSchema).default([]).describe('Grandchildren — children of this family member'),
});

export const GoalSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "goal-1"'),
  name: z.string().describe('Short goal name, e.g. "Retire at 65"'),
  category: z.enum(['retirement', 'wealth', 'protection', 'estate', 'lifestyle', 'education', 'other']).describe('Goal category'),
  detail: z.nullable(z.string()).describe('Additional detail or notes about the goal'),
  timeframe: z.nullable(z.string()).describe('Timeframe, e.g. "5 years", "by 2030", "ongoing"'),
  value: z.nullable(z.number()).describe('Target dollar value if applicable, null otherwise'),
});

export const RelationshipSchema = z.object({
  id: z.string().describe('Unique ID, e.g. "rel-1"'),
  clientIds: z.array(z.string()).default([]).describe('Client IDs this adviser is linked to'),
  type: z.enum(['accountant', 'stockbroker', 'solicitor', 'insurance_adviser', 'mortgage_broker', 'financial_adviser', 'other']).describe('Type of professional adviser'),
  firmName: z.nullable(z.string()).describe('Firm/company name, e.g. "Smith & Partners"'),
  contactName: z.nullable(z.string()).describe('Contact person name, e.g. "John Smith"'),
  notes: z.nullable(z.string()).describe('Additional notes about the relationship'),
});

export const DataGapSchema = z.object({
  entityId: z.nullable(z.string()).describe('Related entity ID, or null for personal gaps'),
  field: z.string().describe('Field name that is missing'),
  description: z.string().describe('Human-readable description of what is needed'),
  nodeId: z.string().optional().describe('Graph node ID this gap refers to'),
});

export const FinancialPlanSchema = z.object({
  clients: z.array(ClientSchema),
  entities: z.array(EntitySchema),
  personalAssets: z.array(AssetSchema).describe('Assets held personally, not in entities'),
  personalLiabilities: z.array(LiabilitySchema).describe('Liabilities held personally'),
  estatePlanning: z.array(EstatePlanItemSchema).default([]).describe('Estate planning documents — wills, POA, guardianship, super nominations. Empty array if none mentioned.'),
  familyMembers: z.array(FamilyMemberSchema).default([]).describe('Direct children (sons/daughters) of the clients. Grandchildren are nested inside each child\'s "children" array. Empty array if none mentioned.'),
  objectives: z.array(z.string()).describe('Financial objectives mentioned in the document'),
  goals: z.array(GoalSchema).default([]).describe('Structured goals and objectives with category, timeframe, and target value. Empty array if none mentioned.'),
  relationships: z.array(RelationshipSchema).default([]).describe('Professional advisers and relationships — accountants, stockbrokers, solicitors, insurance advisers, mortgage brokers. Empty array if none mentioned.'),
  dataGaps: z.array(DataGapSchema).describe('Information that appears missing or unclear'),
});
