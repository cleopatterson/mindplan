import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { InsightsOutputSchema } from '../schema/insights.js';
import { PARSE_SYSTEM_PROMPT } from '../prompts/parseFinancialPlan.js';
import { INSIGHTS_SYSTEM_PROMPT } from '../prompts/generateInsights.js';
import type { FinancialPlan, Insight } from 'shared/types';
import { coercePlan } from './coerce.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b';

const financialPlanJsonSchema = zodToJsonSchema(FinancialPlanSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

const insightsJsonSchema = zodToJsonSchema(InsightsOutputSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

// ── Few-shot example for extraction quality ──

const FEWSHOT_DOC = `FACT FIND — INITIAL MEETING NOTES
Client: Simon Blake
Date: 2 February 2025
Adviser: Jenny Wu, Count Financial

Simon Blake, aged around 44. Works in IT — not sure of exact role or employer.
Says he earns "about $130k".

Super is with some industry fund — couldn't remember which one. Thinks the balance is around $80,000.

Owns a 2-bedroom unit in Newtown, bought a few years ago. Thinks it's worth about $750,000 now. Has a mortgage with Westpac, outstanding amount approximately $480,000.

Has a car — some kind of sedan, maybe 2017 model. Didn't give a value.
Bank account with Westpac, says there's "not much in there, maybe $10,000 or so".

No investment properties, no shares, no other investments.
Single, never married. No children. Parents are both alive and well.

Insurance: Has whatever the default cover is through his super fund. No private insurance.

Estate planning: No will. No power of attorney. Nothing in place.

Objectives:
- "Sort out my finances"
- "Maybe look at getting an investment property eventually"
- Wants to make sure he's "not going to be broke when I'm old"

Other professional advisers:
- Accountant: David Park at Park & Associates
- Solicitor: none currently`;

const FEWSHOT_RESPONSE = JSON.stringify({
  clients: [{
    id: "client-1", name: "Simon Blake", age: 44,
    occupation: "IT (exact role unknown)", income: 130000,
    superBalance: 80000, riskProfile: null,
  }],
  entities: [],
  personalAssets: [
    { id: "asset-1", name: "2-bedroom unit, Newtown", type: "property", value: 750000, ownerIds: ["client-1"], details: "Approximate value" },
    { id: "asset-2", name: "Motor Vehicle", type: "vehicle", value: null, ownerIds: ["client-1"], details: "Sedan, approximately 2017 model" },
    { id: "asset-3", name: "Bank Account (Westpac)", type: "cash", value: 10000, ownerIds: ["client-1"], details: "Approximate balance" },
  ],
  personalLiabilities: [
    { id: "liability-1", name: "Westpac Mortgage - Newtown unit", type: "mortgage", amount: 480000, interestRate: null, ownerIds: ["client-1"], details: "Standard variable rate — exact rate unknown" },
  ],
  estatePlanning: [
    { id: "estate-1", clientId: "client-1", type: "will", status: "not_established", lastReviewed: null, primaryPerson: null, alternatePeople: null, details: "No will in place", hasIssue: true },
    { id: "estate-2", clientId: "client-1", type: "poa", status: "not_established", lastReviewed: null, primaryPerson: null, alternatePeople: null, details: "No power of attorney in place", hasIssue: true },
  ],
  familyMembers: [],
  objectives: ["Sort out finances", "Consider purchasing an investment property", "Ensure adequate retirement savings"],
  goals: [
    { id: "goal-1", name: "Sort out finances", category: "wealth", detail: "General financial organisation", timeframe: null, value: null },
    { id: "goal-2", name: "Purchase investment property", category: "wealth", detail: "Considering buying an investment property", timeframe: null, value: null },
    { id: "goal-3", name: "Retirement savings", category: "retirement", detail: "Ensure adequate retirement savings", timeframe: null, value: null },
  ],
  relationships: [
    { id: "rel-1", clientIds: ["client-1"], type: "accountant", firmName: "Park & Associates", contactName: "David Park", notes: null },
    { id: "rel-2", clientIds: ["client-1"], type: "financial_adviser", firmName: "Count Financial", contactName: "Jenny Wu", notes: null },
  ],
  dataGaps: [],
});

// ── Ollama API ──

interface OllamaChatResponse {
  message: { role: string; content: string };
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

async function ollamaChat(
  model: string,
  messages: { role: string; content: string }[],
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const url = `${OLLAMA_URL}/api/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      format: jsonSchema,
      options: {
        num_ctx: 32768,
        temperature: 0.1,
      },
    }),
    signal: AbortSignal.timeout(600_000),
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
    [
      { role: 'system', content: PARSE_SYSTEM_PROMPT },
      // Few-shot example
      { role: 'user', content: `Extract the complete financial structure from this document:\n\n${FEWSHOT_DOC}` },
      { role: 'assistant', content: FEWSHOT_RESPONSE },
      // Actual document
      { role: 'user', content: `Extract the complete financial structure from this document:\n\n${documentText}` },
    ],
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
    [
      { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this financial plan and produce actionable insights:\n\n${planJson}` },
    ],
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
