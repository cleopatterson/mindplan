import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { ProjectionSettingsSchema } from '../schema/projectionSettings.js';
import { PROJECTION_SETTINGS_SYSTEM_PROMPT } from '../prompts/generateProjectionSettings.js';
import type { ProjectionSettingsResponse, FinancialPlan } from 'shared/types';

export const projectionRouter = Router();

let _client: Anthropic;
function getClient() {
  if (!_client) _client = new Anthropic({ timeout: 60_000 });
  return _client;
}

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

const settingsJsonSchema = zodToJsonSchema(ProjectionSettingsSchema, {
  target: 'openApi3',
  $refStrategy: 'seen',
});

projectionRouter.post('/projection-settings', async (req, res) => {
  const t0 = performance.now();
  try {
    const { data } = req.body;
    if (!data) {
      res.status(400).json({ success: false, error: 'Missing plan data' } satisfies ProjectionSettingsResponse);
      return;
    }

    const parsed = FinancialPlanSchema.safeParse(data);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid plan data' } satisfies ProjectionSettingsResponse);
      return;
    }

    const plan = parsed.data as FinancialPlan;

    // Build a concise summary for Claude to analyze
    const planSummary = buildPlanSummary(plan);

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: PROJECTION_SETTINGS_SYSTEM_PROMPT,
      tools: [
        {
          name: 'generate_projection_settings',
          description: 'Generate smart projection settings based on the financial plan analysis.',
          input_schema: settingsJsonSchema as Anthropic.Tool['input_schema'],
        },
      ],
      tool_choice: { type: 'tool' as const, name: 'generate_projection_settings' },
      messages: [
        {
          role: 'user',
          content: `Analyze this financial plan and generate optimal projection settings:\n\n${planSummary}`,
        },
      ],
    });

    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('Claude did not return projection settings');
    }

    const result = ProjectionSettingsSchema.safeParse(toolBlock.input);
    if (!result.success) {
      console.error('Projection settings validation failed:', result.error.flatten());
      throw new Error('Invalid projection settings from Claude');
    }

    console.log(`⏱ [projection] Settings generated: ${(performance.now() - t0).toFixed(0)}ms | ${result.data.assetOverrides.length} asset overrides, ${result.data.liabilityOverrides.length} liability overrides`);

    res.json({ success: true, settings: result.data } satisfies ProjectionSettingsResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Projection settings error (after ${(performance.now() - t0).toFixed(0)}ms):`, message);
    res.status(500).json({ success: false, error: message } satisfies ProjectionSettingsResponse);
  }
});

/** Build a concise text summary of the plan for Claude to analyze */
function buildPlanSummary(plan: FinancialPlan): string {
  const parts: string[] = [];

  parts.push('## Clients');
  for (const c of plan.clients) {
    parts.push(`- ${c.name}: age ${c.age ?? '?'}, income $${c.income ?? '?'}, occupation: ${c.occupation ?? '?'}, risk: ${c.riskProfile ?? '?'}, super: $${c.superBalance ?? '?'}`);
  }

  parts.push('\n## Personal Assets');
  for (const a of plan.personalAssets) {
    parts.push(`- [${a.id}] ${a.name} (${a.type}): $${a.value ?? '?'}${a.details ? ` | Details: ${a.details}` : ''}`);
  }

  parts.push('\n## Personal Liabilities');
  for (const l of plan.personalLiabilities) {
    parts.push(`- [${l.id}] ${l.name} (${l.type}): $${l.amount ?? '?'}, rate: ${l.interestRate ?? '?'}%${l.details ? ` | Details: ${l.details}` : ''}`);
  }

  for (const e of plan.entities) {
    parts.push(`\n## Entity: ${e.name} (${e.type})`);
    for (const a of e.assets) {
      parts.push(`- [${a.id}] ${a.name} (${a.type}): $${a.value ?? '?'}${a.details ? ` | Details: ${a.details}` : ''}`);
    }
    for (const l of e.liabilities) {
      parts.push(`- [${l.id}] ${l.name} (${l.type}): $${l.amount ?? '?'}, rate: ${l.interestRate ?? '?'}%${l.details ? ` | Details: ${l.details}` : ''}`);
    }
  }

  if (plan.goals?.length) {
    parts.push('\n## Goals');
    for (const g of plan.goals) {
      parts.push(`- ${g.name} (${g.category}): ${g.detail ?? ''}${g.timeframe ? ` [${g.timeframe}]` : ''}${g.value ? ` $${g.value}` : ''}`);
    }
  }

  return parts.join('\n');
}
