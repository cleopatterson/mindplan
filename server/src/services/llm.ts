import type { FinancialPlan, Insight } from 'shared/types';

const PROVIDER = process.env.LLM_PROVIDER || 'claude';

console.log(`🔧 [llm] Provider: ${PROVIDER}`);

export async function parsePlan(documentText: string): Promise<FinancialPlan> {
  if (PROVIDER === 'ollama') {
    const { parseWithOllama } = await import('./ollama.js');
    return parseWithOllama(documentText);
  }
  if (PROVIDER === 'mlx') {
    const { parseWithMlx } = await import('./mlx.js');
    return parseWithMlx(documentText);
  }
  const { parseWithClaude } = await import('./claude.js');
  return parseWithClaude(documentText);
}

export async function generateInsights(plan: FinancialPlan): Promise<Insight[]> {
  if (PROVIDER === 'ollama') {
    const { generateOllamaInsights } = await import('./ollama.js');
    return generateOllamaInsights(plan);
  }
  if (PROVIDER === 'mlx') {
    const { generateMlxInsights } = await import('./mlx.js');
    return generateMlxInsights(plan);
  }
  const { generateInsights: claudeInsights } = await import('./claude.js');
  return claudeInsights(plan);
}
