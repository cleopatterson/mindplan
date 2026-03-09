/**
 * Coerce common small-model JSON mistakes before Zod validation.
 * Shared by both MLX and Ollama providers.
 *
 * Fixes:
 * - Missing nullable fields → null
 * - Invented enum values → mapped or 'other'
 * - Missing arrays → []
 */

const ASSET_TYPE_MAP: Record<string, string> = {
  'residential property': 'property',
  'commercial property': 'property',
  'investment property': 'property',
  'real estate': 'property',
  'managed funds': 'managed_fund',
  'managed fund': 'managed_fund',
  'share': 'shares',
  'equity': 'shares',
  'superannuation': 'super',
  'life insurance': 'insurance',
  'motor vehicle': 'vehicle',
  'car': 'vehicle',
};

const LIABILITY_TYPE_MAP: Record<string, string> = {
  'home loan': 'mortgage',
  'home mortgage': 'mortgage',
  'personal loan': 'loan',
  'car loan': 'loan',
  'credit': 'credit_card',
};

const VALID_ASSET_TYPES = new Set(['property', 'shares', 'cash', 'managed_fund', 'super', 'pension', 'insurance', 'vehicle', 'other']);
const VALID_LIABILITY_TYPES = new Set(['mortgage', 'loan', 'credit_card', 'other']);
const VALID_ENTITY_TYPES = new Set(['trust', 'smsf', 'company', 'partnership']);
const VALID_ESTATE_TYPES = new Set(['will', 'poa', 'guardianship', 'super_nomination']);
const VALID_RELATIONSHIP_TYPES = new Set(['child', 'other']);
const RELATIONSHIP_ALIAS_MAP: Record<string, string> = { son: 'child', daughter: 'child' };
const VALID_GOAL_CATEGORIES = new Set(['retirement', 'wealth', 'protection', 'estate', 'lifestyle', 'education', 'other']);
const VALID_ADVISER_TYPES = new Set(['accountant', 'stockbroker', 'solicitor', 'insurance_adviser', 'mortgage_broker', 'financial_adviser', 'other']);

/** Ensure a key exists on an object, defaulting to null if absent */
function ensureNull(obj: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    if (!(k in obj) || obj[k] === undefined) obj[k] = null;
  }
}

/** Ensure a key exists on an object, defaulting to a value if absent */
function ensureDefault(obj: Record<string, unknown>, key: string, fallback: unknown) {
  if (!(key in obj) || obj[key] === undefined) obj[key] = fallback;
}

/** Map a string field to a valid enum value, falling back to 'other' */
function coerceEnum(obj: Record<string, unknown>, field: string, aliasMap: Record<string, string>, validSet: Set<string>) {
  const val = obj[field];
  if (typeof val !== 'string') return;
  if (validSet.has(val)) return;
  const mapped = aliasMap[val.toLowerCase()];
  obj[field] = mapped ?? 'other';
}

/** Coerce objectives to be an array of strings (model sometimes produces objects) */
function coerceObjectives(plan: Record<string, unknown>) {
  const objectives = plan.objectives;
  if (!Array.isArray(objectives)) return;
  plan.objectives = objectives.map((o: unknown) => {
    if (typeof o === 'string') return o;
    if (o && typeof o === 'object' && 'description' in o) return String((o as Record<string, unknown>).description);
    if (o && typeof o === 'object' && 'name' in o) return String((o as Record<string, unknown>).name);
    return String(o);
  });
}

export function coercePlan(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const plan = raw as Record<string, unknown>;

  // Ensure top-level arrays exist
  ensureDefault(plan, 'clients', []);
  ensureDefault(plan, 'entities', []);
  ensureDefault(plan, 'personalAssets', []);
  ensureDefault(plan, 'personalLiabilities', []);
  ensureDefault(plan, 'estatePlanning', []);
  ensureDefault(plan, 'familyMembers', []);
  ensureDefault(plan, 'objectives', []);
  ensureDefault(plan, 'expenses', []);
  ensureDefault(plan, 'dataGaps', []);

  // Clients
  for (const c of (plan.clients as Record<string, unknown>[]) ?? []) {
    ensureNull(c, 'age', 'occupation', 'income', 'superBalance', 'riskProfile');
  }

  // Assets (personal + entity-held)
  const allAssets = [
    ...((plan.personalAssets as Record<string, unknown>[]) ?? []),
  ];
  for (const entity of (plan.entities as Record<string, unknown>[]) ?? []) {
    ensureDefault(entity, 'assets', []);
    ensureDefault(entity, 'liabilities', []);
    allAssets.push(...((entity.assets as Record<string, unknown>[]) ?? []));
  }
  for (const a of allAssets) {
    ensureNull(a, 'value', 'details');
    ensureDefault(a, 'ownerIds', []);
    coerceEnum(a, 'type', ASSET_TYPE_MAP, VALID_ASSET_TYPES);
  }

  // Liabilities (personal + entity-held)
  const allLiabilities = [
    ...((plan.personalLiabilities as Record<string, unknown>[]) ?? []),
  ];
  for (const entity of (plan.entities as Record<string, unknown>[]) ?? []) {
    allLiabilities.push(...((entity.liabilities as Record<string, unknown>[]) ?? []));
  }
  for (const l of allLiabilities) {
    ensureNull(l, 'amount', 'interestRate', 'details');
    ensureDefault(l, 'ownerIds', []);
    coerceEnum(l, 'type', LIABILITY_TYPE_MAP, VALID_LIABILITY_TYPES);
  }

  // Entities
  for (const e of (plan.entities as Record<string, unknown>[]) ?? []) {
    ensureNull(e, 'role', 'trusteeName', 'trusteeType');
    ensureDefault(e, 'linkedClientIds', []);
    coerceEnum(e, 'type', {}, VALID_ENTITY_TYPES);
  }

  // Estate planning
  for (const ep of (plan.estatePlanning as Record<string, unknown>[]) ?? []) {
    ensureNull(ep, 'clientId', 'status', 'lastReviewed', 'primaryPerson', 'alternatePeople', 'details');
    ensureDefault(ep, 'hasIssue', false);
    coerceEnum(ep, 'type', { 'power_of_attorney': 'poa', 'power of attorney': 'poa', 'super': 'super_nomination', 'superannuation': 'super_nomination' }, VALID_ESTATE_TYPES);
    // Coerce invented status values
    const status = ep.status;
    if (typeof status === 'string' && !['current', 'expired', 'not_established'].includes(status)) {
      ep.status = status.toLowerCase().includes('not') || status.toLowerCase().includes('none') ? 'not_established' : null;
    }
  }

  // Family members
  for (const fm of (plan.familyMembers as Record<string, unknown>[]) ?? []) {
    ensureNull(fm, 'partner', 'age', 'details');
    ensureDefault(fm, 'isDependant', false);
    ensureDefault(fm, 'children', []);
    coerceEnum(fm, 'relationship', RELATIONSHIP_ALIAS_MAP, VALID_RELATIONSHIP_TYPES);
    for (const gc of (fm.children as Record<string, unknown>[]) ?? []) {
      ensureNull(gc, 'age', 'details');
      ensureDefault(gc, 'isDependant', false);
    }
  }

  // Data gaps
  for (const dg of (plan.dataGaps as Record<string, unknown>[]) ?? []) {
    ensureNull(dg, 'entityId');
  }

  // Goals (ensure required fields)
  ensureDefault(plan, 'goals', []);
  for (const g of (plan.goals as Record<string, unknown>[]) ?? []) {
    ensureDefault(g, 'id', `goal-${Math.random().toString(36).slice(2, 6)}`);
    ensureDefault(g, 'name', '');
    ensureNull(g, 'detail', 'timeframe', 'value');
    coerceEnum(g, 'category', {}, VALID_GOAL_CATEGORIES);
  }

  // Relationships (filter out non-professional entries, ensure fields)
  ensureDefault(plan, 'relationships', []);
  const relationships = plan.relationships as Record<string, unknown>[];
  if (Array.isArray(relationships)) {
    plan.relationships = relationships.filter((r) => {
      const type = r.type;
      if (typeof type !== 'string') return false;
      return VALID_ADVISER_TYPES.has(type) || VALID_ADVISER_TYPES.has(type.toLowerCase());
    });
    for (const r of plan.relationships as Record<string, unknown>[]) {
      ensureNull(r, 'firmName', 'contactName', 'notes');
      ensureDefault(r, 'clientIds', []);
      coerceEnum(r, 'type', { 'financial adviser': 'financial_adviser', 'insurance adviser': 'insurance_adviser', 'mortgage broker': 'mortgage_broker' }, VALID_ADVISER_TYPES);
    }
  }

  // Objectives (sometimes objects instead of strings)
  coerceObjectives(plan);
}
