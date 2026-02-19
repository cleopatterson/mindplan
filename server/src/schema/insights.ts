import { z } from 'zod';

export const InsightSchema = z.object({
  category: z.enum(['concentration', 'liquidity', 'tax', 'estate', 'debt', 'insurance', 'structure']),
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string().describe('Short headline, e.g. "High property concentration"'),
  detail: z.string().describe('1-2 sentence actionable observation referencing specific entities/values'),
  nodeIds: z.array(z.string()).describe('IDs of the plan nodes this insight refers to (e.g. "asset-1", "entity-2", "client-1", "estate-3"). Use the exact id fields from the plan data.'),
});

export const InsightsOutputSchema = z.object({
  insights: z.array(InsightSchema).min(3).max(6),
});
