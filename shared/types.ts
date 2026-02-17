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
  | 'insurance'
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
  relationship: 'son' | 'daughter' | 'other';
  partner: string | null;        // spouse/partner name
  age: number | null;
  isDependant: boolean;
  details: string | null;
  children: Grandchild[];        // grandchildren nested under their parent
}

export interface Grandchild {
  id: string;
  name: string;
  relationship: 'grandson' | 'granddaughter';
  age: number | null;
  isDependant: boolean;
  details: string | null;
}

export interface DataGap {
  entityId: string | null;
  field: string;
  description: string;
  nodeId?: string;             // graph node ID this gap refers to (set by validator)
}

// ── API types ──

export interface ParseResponse {
  success: boolean;
  data?: FinancialPlan;
  error?: string;
  extractedTextLength?: number;
}
