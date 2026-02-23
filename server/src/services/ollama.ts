import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { InsightsOutputSchema } from '../schema/insights.js';
import { PARSE_SYSTEM_PROMPT } from '../prompts/parseFinancialPlan.js';
import { INSIGHTS_SYSTEM_PROMPT } from '../prompts/generateInsights.js';
import type { FinancialPlan, Insight } from 'shared/types';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';

const financialPlanJsonSchema = zodToJsonSchema(FinancialPlanSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

const insightsJsonSchema = zodToJsonSchema(InsightsOutputSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

// ── Coerce common small-model mistakes before Zod validation ──

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

const VALID_ASSET_TYPES = new Set(['property', 'shares', 'cash', 'managed_fund', 'super', 'insurance', 'vehicle', 'other']);
const VALID_LIABILITY_TYPES = new Set(['mortgage', 'loan', 'credit_card', 'other']);
const VALID_ENTITY_TYPES = new Set(['trust', 'smsf', 'company', 'partnership']);
const VALID_ESTATE_TYPES = new Set(['will', 'poa', 'guardianship', 'super_nomination']);

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

/**
 * Patch the raw Ollama JSON to fix common small-model issues:
 * - Missing nullable fields → null
 * - Invented enum values → mapped or 'other'
 * - Missing arrays → []
 */
function coercePlan(raw: unknown): void {
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
  ensureDefault(plan, 'dataGaps', []);

  // Clients
  for (const c of (plan.clients as Record<string, unknown>[]) ?? []) {
    ensureNull(c, 'age', 'occupation', 'income', 'superBalance');
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
    ensureNull(ep, 'status', 'lastReviewed', 'primaryPerson', 'alternatePeople', 'details');
    ensureDefault(ep, 'hasIssue', false);
    coerceEnum(ep, 'type', { 'power_of_attorney': 'poa', 'power of attorney': 'poa' }, VALID_ESTATE_TYPES);
  }

  // Family members
  for (const fm of (plan.familyMembers as Record<string, unknown>[]) ?? []) {
    ensureNull(fm, 'partner', 'age', 'details');
    ensureDefault(fm, 'isDependant', false);
    ensureDefault(fm, 'children', []);
    for (const gc of (fm.children as Record<string, unknown>[]) ?? []) {
      ensureNull(gc, 'age', 'details');
      ensureDefault(gc, 'isDependant', false);
    }
  }

  // Data gaps
  for (const dg of (plan.dataGaps as Record<string, unknown>[]) ?? []) {
    ensureNull(dg, 'entityId');
  }
}

interface OllamaChatResponse {
  message: { role: string; content: string };
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

async function ollamaChat(
  model: string,
  systemPrompt: string,
  userMessage: string,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const url = `${OLLAMA_URL}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      format: jsonSchema,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  const durationMs = data.total_duration ? (data.total_duration / 1_000_000).toFixed(0) : '?';
  console.log(
    `⏱ [ollama] Response: ${durationMs}ms | tokens: ${data.prompt_eval_count ?? '?'} in / ${data.eval_count ?? '?'} out`,
  );

  return data.message.content;
}

export async function parseWithOllama(documentText: string): Promise<FinancialPlan> {
  console.log(`⏱ [ollama] Input text: ${documentText.length} chars, model: ${OLLAMA_MODEL}`);

  const t0 = performance.now();
  const raw = await ollamaChat(
    OLLAMA_MODEL,
    PARSE_SYSTEM_PROMPT,
    `Extract the complete financial structure from this document:\n\n${documentText}`,
    financialPlanJsonSchema,
  );
  console.log(`⏱ [ollama] Total API call: ${(performance.now() - t0).toFixed(0)}ms`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[ollama] Failed to parse JSON response:', raw.slice(0, 500));
    throw new Error('Ollama did not return valid JSON');
  }

  // Coerce common small-model mistakes before validation
  coercePlan(parsed);

  const t1 = performance.now();
  const result = FinancialPlanSchema.safeParse(parsed);
  console.log(`⏱ [ollama] Zod validation: ${(performance.now() - t1).toFixed(0)}ms`);

  if (!result.success) {
    console.error('[ollama] Zod validation failed:', result.error.issues);
    throw new Error('Ollama returned data that did not match the expected schema.');
  }

  return result.data as FinancialPlan;
}

export async function generateOllamaInsights(plan: FinancialPlan): Promise<Insight[]> {
  const planJson = JSON.stringify(plan);
  console.log(`⏱ [ollama-insights] Input plan: ${planJson.length} chars, model: ${OLLAMA_MODEL}`);

  const t0 = performance.now();
  const raw = await ollamaChat(
    OLLAMA_MODEL,
    INSIGHTS_SYSTEM_PROMPT,
    `Analyze this financial plan and produce actionable insights:\n\n${planJson}`,
    insightsJsonSchema,
  );
  console.log(`⏱ [ollama-insights] Total API call: ${(performance.now() - t0).toFixed(0)}ms`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[ollama-insights] Failed to parse JSON response:', raw.slice(0, 500));
    throw new Error('Ollama did not return valid JSON for insights');
  }

  const result = InsightsOutputSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[ollama-insights] Zod validation failed:', result.error.issues);
    throw new Error('Ollama insights did not match the expected schema.');
  }

  return result.data.insights as Insight[];
}
