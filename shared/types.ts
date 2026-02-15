// ── Financial Plan Data Model ──
// Both server (Claude output) and client (rendering) use these types.

export interface FinancialPlan {
  clients: Client[];
  entities: Entity[];
  personalAssets: Asset[];
  personalLiabilities: Liability[];
  objectives: string[];
  dataGaps: DataGap[];
}

export interface Client {
  id: string;
  name: string;
  age: number | null;
  occupation: string | null;
  income: number | null;
  superBalance: number | null;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  /** Which client IDs are linked (trustees, directors, beneficiaries) */
  linkedClientIds: string[];
  role: string | null; // e.g. "Trustee", "Director", "Appointer"
  assets: Asset[];
  liabilities: Liability[];
}

export type EntityType = 'trust' | 'smsf' | 'company' | 'partnership';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number | null;
  details: string | null;
}

export type AssetType =
  | 'property'
  | 'shares'
  | 'cash'
  | 'managed_fund'
  | 'super'
  | 'insurance'
  | 'vehicle'
  | 'other';

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  amount: number | null;
  interestRate: number | null;
  details: string | null;
}

export type LiabilityType = 'mortgage' | 'loan' | 'credit_card' | 'other';

export interface DataGap {
  entityId: string | null;
  field: string;
  description: string;
}

// ── API types ──

export interface ParseResponse {
  success: boolean;
  data?: FinancialPlan;
  error?: string;
  extractedTextLength?: number;
}
