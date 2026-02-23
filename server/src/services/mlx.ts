import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { InsightsOutputSchema } from '../schema/insights.js';
import { PARSE_SYSTEM_PROMPT } from '../prompts/parseFinancialPlan.js';
import { INSIGHTS_SYSTEM_PROMPT } from '../prompts/generateInsights.js';
import type { FinancialPlan, Insight } from 'shared/types';

const MLX_URL = process.env.MLX_URL || 'http://127.0.0.1:8080';

const financialPlanJsonSchema = zodToJsonSchema(FinancialPlanSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

const insightsJsonSchema = zodToJsonSchema(InsightsOutputSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

async function mlxChat(
  systemPrompt: string,
  userMessage: string,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const url = `${MLX_URL}/v1/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600_000), // 10 minute timeout for slow local models
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Respond with ONLY a valid JSON object. No explanation, no markdown, no code blocks.' },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 16000,
      temperature: 0.1,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MLX server error (${response.status}): ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;

  const usage = data.usage;
  if (usage) {
    console.log(
      `⏱ [mlx] tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out`,
    );
  }

  return data.choices[0].message.content;
}

/** Extract JSON from a response that may have preamble text before/after the JSON */
function extractJson(raw: string): string {
  // Try parsing raw first
  try {
    JSON.parse(raw);
    return raw;
  } catch { /* fall through */ }

  // Look for first { and last } to extract the JSON object
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch { /* fall through */ }
  }

  // Look for ```json code blocks
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return raw;
}

export async function parseWithMlx(documentText: string): Promise<FinancialPlan> {
  console.log(`⏱ [mlx] Input text: ${documentText.length} chars`);

  const t0 = performance.now();
  const raw = await mlxChat(
    PARSE_SYSTEM_PROMPT,
    `Extract the complete financial structure from this document:\n\n${documentText}`,
    financialPlanJsonSchema,
  );
  console.log(`⏱ [mlx] Total API call: ${(performance.now() - t0).toFixed(0)}ms`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    console.error('[mlx] Failed to parse JSON response:', raw.slice(0, 500));
    throw new Error('MLX server did not return valid JSON');
  }

  const result = FinancialPlanSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[mlx] Zod validation failed:', result.error.issues);
    throw new Error('MLX output did not match the expected schema.');
  }

  return result.data as FinancialPlan;
}

export async function generateMlxInsights(plan: FinancialPlan): Promise<Insight[]> {
  const planJson = JSON.stringify(plan);
  console.log(`⏱ [mlx-insights] Input plan: ${planJson.length} chars`);

  const t0 = performance.now();
  const raw = await mlxChat(
    INSIGHTS_SYSTEM_PROMPT,
    `Analyze this financial plan and produce actionable insights:\n\n${planJson}`,
    insightsJsonSchema,
  );
  console.log(`⏱ [mlx-insights] Total API call: ${(performance.now() - t0).toFixed(0)}ms`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    console.error('[mlx-insights] Failed to parse JSON response:', raw.slice(0, 500));
    throw new Error('MLX server did not return valid JSON for insights');
  }

  const result = InsightsOutputSchema.safeParse(parsed);
  if (!result.success) {
    console.error('[mlx-insights] Zod validation failed:', result.error.issues);
    throw new Error('MLX insights did not match the expected schema.');
  }

  return result.data.insights as Insight[];
}
