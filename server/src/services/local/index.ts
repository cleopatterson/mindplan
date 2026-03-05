/**
 * Local code-based parser entry point.
 * Replaces Claude API for Plutosoft "Client Fact Find" .docx documents.
 */
import type { FinancialPlan } from 'shared/types';
import { splitSections } from './splitSections.js';
import { assemble } from './assembler.js';

export async function parseWithLocal(documentText: string): Promise<FinancialPlan> {
  const t0 = performance.now();

  // Step 1: Split into named sections
  const sections = splitSections(documentText);

  // Step 2: Assemble into FinancialPlan
  const plan = assemble(sections);

  console.log(`⏱ [local] Parse complete: ${(performance.now() - t0).toFixed(0)}ms — ${plan.clients.length} clients, ${plan.entities.length} entities, ${plan.personalAssets.length} assets`);

  return plan;
}
