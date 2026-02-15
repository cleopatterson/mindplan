import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import { PARSE_SYSTEM_PROMPT } from '../prompts/parseFinancialPlan.js';
import type { FinancialPlan } from 'shared/types';

let _client: Anthropic;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const jsonSchema = zodToJsonSchema(FinancialPlanSchema, {
  target: 'openApi3',
  $refStrategy: 'none',
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

export async function parseWithClaude(documentText: string): Promise<FinancialPlan> {
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

  // Find the tool_use block
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return structured data');
  }

  // Validate against Zod schema
  const parsed = FinancialPlanSchema.parse(toolBlock.input);
  return parsed as FinancialPlan;
}
