import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { InsightsOutputSchema } from '../schema/insights.js';
import { PARSE_SYSTEM_PROMPT } from '../prompts/parseFinancialPlan.js';
import { INSIGHTS_SYSTEM_PROMPT } from '../prompts/generateInsights.js';
import type { FinancialPlan, Insight } from 'shared/types';

let _client: Anthropic;
function getClient() {
  if (!_client) _client = new Anthropic({ timeout: 120_000 });
  return _client;
}

const jsonSchema = zodToJsonSchema(FinancialPlanSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

export async function parseWithClaude(documentText: string): Promise<FinancialPlan> {
  console.log(`⏱ [claude] Input text: ${documentText.length} chars, model: ${MODEL}`);

  const t0 = performance.now();
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: PARSE_SYSTEM_PROMPT,
    tools: [
      {
        name: 'extract_financial_plan',
        description: 'Extract structured financial plan data from the document text.',
        input_schema: jsonSchema as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool' as const, name: 'extract_financial_plan' },
    messages: [
      {
        role: 'user',
        content: `Extract the complete financial structure from this document:\n\n${documentText}`,
      },
    ],
  });
  const apiMs = performance.now() - t0;

  console.log(`⏱ [claude] API response: ${apiMs.toFixed(0)}ms | tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out | stop: ${response.stop_reason}`);

  // Find the tool_use block
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return structured data');
  }

  // Validate against Zod schema
  const t1 = performance.now();
  const result = FinancialPlanSchema.safeParse(toolBlock.input);
  console.log(`⏱ [claude] Zod validation: ${(performance.now() - t1).toFixed(0)}ms`);

  if (!result.success) {
    console.error('[claude] Zod validation failed:', result.error.issues);
    throw new Error('Claude returned data that did not match the expected schema.');
  }

  return result.data as FinancialPlan;
}

// ── Insights generation ──

const insightsJsonSchema = zodToJsonSchema(InsightsOutputSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

export async function generateInsights(plan: FinancialPlan): Promise<Insight[]> {
  const planJson = JSON.stringify(plan);
  console.log(`⏱ [insights] Input plan: ${planJson.length} chars, model: ${MODEL}`);

  const t0 = performance.now();
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: INSIGHTS_SYSTEM_PROMPT,
    tools: [
      {
        name: 'generate_insights',
        description: 'Generate actionable financial insights from the structured plan data.',
        input_schema: insightsJsonSchema as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool' as const, name: 'generate_insights' },
    messages: [
      {
        role: 'user',
        content: `Analyze this financial plan and produce actionable insights:\n\n${planJson}`,
      },
    ],
  });
  const apiMs = performance.now() - t0;

  console.log(`⏱ [insights] API response: ${apiMs.toFixed(0)}ms | tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return insights');
  }

  const result = InsightsOutputSchema.safeParse(toolBlock.input);
  if (!result.success) {
    console.error('[insights] Zod validation failed:', result.error.issues);
    throw new Error('Insights did not match the expected schema.');
  }

  return result.data.insights as Insight[];
}
