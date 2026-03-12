// ── Financial Plan Data Model ──
// Both server (Claude output) and client (rendering) use these types.

export interface FinancialPlan {
  clients: Client[];
  entities: Entity[];
  personalAssets: Asset[];
  personalLiabilities: Liability[];
  estatePlanning: EstatePlanItem[];
  familyMembers: FamilyMember[];
  objectives: string[];
  goals: Goal[];
  relationships: Relationship[];
  expenses: Expense[];
  insurance: InsuranceCover[];
  dataGaps: DataGap[];
  familyLabel?: string;  // optional override for the centre tile name
}

export interface InsuranceCover {
  id: string;
  clientId: string;
  type: InsuranceCoverType;
  coverAmount: number | null;
  policyName: string | null;
  isInsideSuper: boolean;
  details: string | null;
}

export type InsuranceCoverType = 'life' | 'tpd' | 'trauma' | 'income_protection';

export interface Client {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  income: number | null;
  superBalance: number | null;
  riskProfile: RiskProfile | null;
}

export type RiskProfile = 'conservative' | 'moderately_conservative' | 'balanced' | 'growth' | 'high_growth';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  /** Which client IDs are linked (trustees, directors, beneficiaries) */
  linkedClientIds: string[];
  role: string | null; // e.g. "Trustee", "Director", "Appointer"
  trusteeName: string | null;                      // "Tony Wall" or "Smith Corp Pty Ltd"
  trusteeType: 'individual' | 'corporate' | null;  // null if unknown
  assets: Asset[];
  liabilities: Liability[];
}

export type EntityType = 'trust' | 'smsf' | 'company' | 'partnership';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number | null;
  ownerIds: string[];    // client IDs — e.g. ["client-1","client-2"] for joint
  details: string | null;
}

export type AssetType =
  | 'property'
  | 'shares'
  | 'cash'
  | 'managed_fund'
  | 'super'
  | 'pension'
  | 'vehicle'
  | 'other';

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number | null;
  interestRate: number | null;
  ownerIds: string[];    // client IDs — e.g. ["client-1","client-2"] for joint
  details: string | null;
}

export type LiabilityType = 'mortgage' | 'loan' | 'credit_card' | 'other';

export interface EstatePlanItem {
  id: string;
  clientId: string;              // links to Client.id
  type: 'will' | 'poa' | 'guardianship' | 'super_nomination';
  status: 'current' | 'expired' | 'not_established' | null;
  lastReviewed: number | null;   // year, e.g. 2021
  primaryPerson: string | null;  // executor / attorney / guardian
  alternatePeople: string[] | null;
  details: string | null;
  hasIssue: boolean;             // expired, not_established, etc.
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: 'child' | 'other';
  partner: string | null;        // spouse/partner name
  age: number | null;
  isDependant: boolean;
  details: string | null;
  children: Grandchild[];        // grandchildren nested under their parent
}

export interface Grandchild {
  id: string;
  name: string;
  relationship: 'grandchild';
  age: number | null;
  isDependant: boolean;
  details: string | null;
}

export interface Goal {
  id: string;
  name: string;
  category: 'retirement' | 'wealth' | 'protection' | 'estate' | 'lifestyle' | 'education' | 'other';
  detail: string | null;
  timeframe: string | null;
  value: number | null;
}

export interface Relationship {
  id: string;
  clientIds: string[];
  type: 'accountant' | 'stockbroker' | 'solicitor' | 'insurance_adviser' | 'mortgage_broker' | 'financial_adviser' | 'other';
  firmName: string | null;
  contactName: string | null;
  notes: string | null;
}

export interface Expense {
  id: string;
  name: string;
  amount: number | null;         // annual amount in AUD
  ownerIds: string[];            // client IDs
  details: string | null;
}

export interface DataGap {
  entityId: string | null;
  field: string;
  description: string;
  nodeId?: string;             // graph node ID this gap refers to (set by validator)
}

// ── Projection types ──

export interface ProjectionSettings {
  horizonYears: number;              // e.g. 30
  inflationRate: number;             // e.g. 2.5
  salaryGrowthRate: number;          // e.g. 3.0
  superContributionRate: number;     // employer SG rate, e.g. 11.5
  superContributionsTaxRate: number; // tax on SG contributions, e.g. 15
  superEarningsTaxRate: number;      // tax on accumulation earnings, e.g. 15 (0 for pension)
  superPreservationAge: number;      // age super can be accessed, e.g. 60
  pprAssetIds: string[];             // asset IDs tagged as primary residence (excluded from drawdown/income)
  retirementRiskProfile: RiskProfile | null; // risk profile to shift to at retirement (null = no shift)
  concessionalCap: number;           // max concessional super contributions p.a., e.g. 30000
  div293Threshold: number;           // income threshold for Div 293 extra 15% tax, e.g. 250000
  enableAgePension: boolean;         // model simplified Age Pension income post-67
  frankingCreditRate: number;        // company tax rate for franking credits, e.g. 30
  clients: ClientProjectionSettings[];
  assetOverrides: AssetReturnOverride[];
  liabilityOverrides: LiabilityOverride[];
  ongoingExpenses: OngoingExpense[];
  lumpSumExpenses: LumpSumExpense[];
}

export interface OngoingExpense {
  id: string;
  name: string;
  annualAmount: number;              // e.g. 50000
  indexedToInflation: boolean;       // whether amount grows with inflation
}

export interface LumpSumExpense {
  id: string;
  name: string;
  amount: number;                    // e.g. 100000
  targetYear: number;                // e.g. 2027
}

export interface ClientProjectionSettings {
  clientId: string;
  retirementAge: number;             // e.g. 65
  salarySacrificeAmount: number;     // annual pre-tax salary sacrifice to super, e.g. 10000
}

export interface AssetReturnOverride {
  assetId: string;
  growthRate: number;                // TOTAL annual return %, e.g. 7.0 (income + capital)
  incomeRate?: number;               // income portion %, e.g. 3.0 (dividends, rent, interest)
  reason?: string;                   // "Rental yield 4.2% from details"
}

export interface LiabilityOverride {
  liabilityId: string;
  interestRate: number;              // annual %, e.g. 6.2
  remainingTermYears: number;        // e.g. 25
  reason?: string;
}

export interface ProjectionYearData {
  year: number;
  property: number;
  shares: number;
  super: number;
  cash: number;
  vehicle: number;
  other: number;
  liabilities: number;              // negative value
  netWorth: number;
  income: number;                    // employment income
  assetIncome: number;               // investment income (dividends, rent, interest)
  expenses: number;                  // total expenses for this year
}

export interface ProjectionMilestone {
  year: number;
  label: string;
}

export interface ProjectionAssetDetail {
  name: string;
  type: string;
  startValue: number;
  endValue: number;
  growthRate: number;
}

export interface ProjectionLiabilityDetail {
  name: string;
  type: string;
  startBalance: number;
  endBalance: number;
  interestRate: number;
  termYears: number;
  annualPayment: number;
  paidOffYear: number | null;
}

export interface ProjectionResult {
  yearData: ProjectionYearData[];
  milestones: ProjectionMilestone[];
  netWorthAtRetirement: number | null;
  superAtRetirement: number | null;
  yearsUntilDebtFree: number | null;
  assetDetails: ProjectionAssetDetail[];
  liabilityDetails: ProjectionLiabilityDetail[];
  retirementYear: number | null;
}

export interface ProjectionSettingsResponse {
  success: boolean;
  settings?: ProjectionSettings;
  error?: string;
}

// ── Insight types ──

export interface Insight {
  category: 'concentration' | 'liquidity' | 'tax' | 'estate' | 'debt' | 'insurance' | 'structure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  nodeIds: string[];
}

export interface InsightsResponse {
  success: boolean;
  insights?: Insight[];
  error?: string;
}

// ── API types ──

export interface ParseResponse {
  success: boolean;
  data?: FinancialPlan;
  error?: string;
  extractedTextLength?: number;
}
