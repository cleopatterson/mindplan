import type { FinancialPlan, Insight } from 'shared/types';

function getProvider() {
  return process.env.LLM_PROVIDER || 'claude';
}

let logged = false;

export async function parsePlan(documentText: string): Promise<FinancialPlan> {
  const provider = getProvider();
  if (!logged) { console.log(`🔧 [llm] Provider: ${provider}`); logged = true; }
  if (provider === 'local') {
    const { parseWithLocal } = await import('./local/index.js');
    return parseWithLocal(documentText);
  }
  if (provider === 'ollama') {
    const { parseWithOllama } = await import('./ollama.js');
    return parseWithOllama(documentText);
  }
  if (provider === 'mlx') {
    const { parseWithMlx } = await import('./mlx.js');
    return parseWithMlx(documentText);
  }
  const { parseWithClaude } = await import('./claude.js');
  return parseWithClaude(documentText);
}

export async function generateInsights(plan: FinancialPlan): Promise<Insight[]> {
  const provider = getProvider();
  if (provider === 'local') {
    return [];
  }
  if (provider === 'ollama') {
    const { generateOllamaInsights } = await import('./ollama.js');
    return generateOllamaInsights(plan);
  }
  if (provider === 'mlx') {
    const { generateMlxInsights } = await import('./mlx.js');
    return generateMlxInsights(plan);
  }
  const { generateInsights: claudeInsights } = await import('./claude.js');
  return claudeInsights(plan);
}
