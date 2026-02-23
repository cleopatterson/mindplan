import { Router } from 'express';
import { generateInsights } from '../services/claude.js';
import { FinancialPlanSchema } from '../schema/financialPlan.js';
import type { InsightsResponse } from 'shared/types';

export const insightsRouter = Router();

insightsRouter.post('/insights', async (req, res) => {
  const t0 = performance.now();
  try {
    const { data } = req.body;
    if (!data) {
      res.status(400).json({ success: false, error: 'Missing plan data' } satisfies InsightsResponse);
      return;
    }

    const parsed = FinancialPlanSchema.safeParse(data);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid plan data' } satisfies InsightsResponse);
      return;
    }

    const insights = await generateInsights(parsed.data as import('shared/types').FinancialPlan);
    console.log(`⏱ [insights] Total request: ${(performance.now() - t0).toFixed(0)}ms (${insights.length} insights)`);

    res.json({ success: true, insights } satisfies InsightsResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Insights error (after ${(performance.now() - t0).toFixed(0)}ms):`, message);
    res.status(500).json({ success: false, error: message } satisfies InsightsResponse);
  }
});
