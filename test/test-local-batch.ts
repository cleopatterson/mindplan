/**
 * Batch test: run all 73 client files through local parser
 * and compare against Claude gold standard in batch-data.json.
 */
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const goldData: any[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'),
);

const clientDir = path.join(__dirname, '..', 'client_files');

interface Metrics {
  file: string;
  clientCountMatch: boolean;
  entityCountMatch: boolean;
  personalAssetCountMatch: boolean;
  liabilityCountMatch: boolean;
  goalCountMatch: boolean;
  familyCountMatch: boolean;
  relationshipCountMatch: boolean;
  estateCountMatch: boolean;
  totalAssetValueDiff: number; // percentage diff
  totalLiabilityDiff: number;
  superBalanceMatch: boolean;
  ageMatch: boolean;
  incomeMatch: boolean;
  riskProfileMatch: boolean;
  passed: boolean;
  issues: string[];
}

async function runBatch() {
  const t0 = performance.now();
  const metrics: Metrics[] = [];
  let passed = 0;
  let failed = 0;

  for (const gold of goldData) {
    const filePath = path.join(clientDir, gold.file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${gold.file} (not found)`);
      continue;
    }

    try {
      const buf = fs.readFileSync(filePath);
      const { value: text } = await mammoth.extractRawText({ buffer: buf });
      const sections = splitSections(text);
      const plan = assemble(sections);

      const gd = gold.data;
      const issues: string[] = [];

      // Client count
      const clientCountMatch = plan.clients.length === gd.clients.length;
      if (!clientCountMatch) issues.push(`clients: ${plan.clients.length} vs ${gd.clients.length}`);

      // Entity count
      const entityCountMatch = plan.entities.length === gd.entities.length;
      if (!entityCountMatch) issues.push(`entities: ${plan.entities.length} vs ${gd.entities.length}`);

      // Personal asset count
      const personalAssetCountMatch = plan.personalAssets.length === gd.personalAssets.length;
      if (!personalAssetCountMatch) issues.push(`personalAssets: ${plan.personalAssets.length} vs ${gd.personalAssets.length}`);

      // Liability count
      const liabilityCountMatch = plan.personalLiabilities.length === gd.personalLiabilities.length;
      if (!liabilityCountMatch) issues.push(`liabilities: ${plan.personalLiabilities.length} vs ${gd.personalLiabilities.length}`);

      // Goal count (allow ±1 difference)
      const goalDiff = Math.abs(plan.goals.length - gd.goals.length);
      const goalCountMatch = goalDiff <= 1;

      // Family count
      const familyCountMatch = plan.familyMembers.length === gd.familyMembers.length;

      // Relationship count
      const relationshipCountMatch = plan.relationships.length === gd.relationships.length;

      // Estate count
      const estateCountMatch = plan.estatePlanning.length === gd.estatePlanning.length;

      // Total asset value comparison
      const localAssetTotal = sumAssetValues(plan);
      const goldAssetTotal = sumAssetValues(gd);
      const totalAssetValueDiff = goldAssetTotal > 0
        ? Math.abs(localAssetTotal - goldAssetTotal) / goldAssetTotal * 100
        : localAssetTotal === 0 ? 0 : 100;

      // Total liability comparison
      const localLiabTotal = sumLiabilityAmounts(plan);
      const goldLiabTotal = sumLiabilityAmounts(gd);
      const totalLiabilityDiff = goldLiabTotal > 0
        ? Math.abs(localLiabTotal - goldLiabTotal) / goldLiabTotal * 100
        : localLiabTotal === 0 ? 0 : 100;

      // Per-client comparisons
      let superBalanceMatch = true;
      let ageMatch = true;
      let incomeMatch = true;
      let riskProfileMatch = true;

      for (let c = 0; c < Math.min(plan.clients.length, gd.clients.length); c++) {
        const lc = plan.clients[c];
        const gc = gd.clients[c];
        if (lc.superBalance !== gc.superBalance) superBalanceMatch = false;
        if (lc.age !== gc.age) ageMatch = false;
        if (lc.income !== null && gc.income !== null && Math.abs(lc.income - gc.income) > 1) {
          incomeMatch = false;
        }
        if (lc.riskProfile !== gc.riskProfile) riskProfileMatch = false;
      }

      // Pass criteria: client count match + entity count match + asset value within 5%
      const isPassed = clientCountMatch && entityCountMatch && totalAssetValueDiff < 5;

      if (isPassed) passed++;
      else {
        failed++;
        if (!clientCountMatch || !entityCountMatch || totalAssetValueDiff >= 5) {
          if (totalAssetValueDiff >= 5) issues.push(`assetValueDiff: ${totalAssetValueDiff.toFixed(1)}%`);
        }
      }

      metrics.push({
        file: gold.file,
        clientCountMatch,
        entityCountMatch,
        personalAssetCountMatch,
        liabilityCountMatch,
        goalCountMatch,
        familyCountMatch,
        relationshipCountMatch,
        estateCountMatch,
        totalAssetValueDiff,
        totalLiabilityDiff,
        superBalanceMatch,
        ageMatch,
        incomeMatch,
        riskProfileMatch,
        passed: isPassed,
        issues,
      });
    } catch (err: any) {
      failed++;
      metrics.push({
        file: gold.file,
        clientCountMatch: false,
        entityCountMatch: false,
        personalAssetCountMatch: false,
        liabilityCountMatch: false,
        goalCountMatch: false,
        familyCountMatch: false,
        relationshipCountMatch: false,
        estateCountMatch: false,
        totalAssetValueDiff: 100,
        totalLiabilityDiff: 100,
        superBalanceMatch: false,
        ageMatch: false,
        incomeMatch: false,
        riskProfileMatch: false,
        passed: false,
        issues: [`ERROR: ${err.message}`],
      });
    }
  }

  const elapsed = performance.now() - t0;

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BATCH TEST RESULTS: ${passed}/${passed + failed} passed (${elapsed.toFixed(0)}ms total)`);
  console.log(`${'='.repeat(60)}\n`);

  // Aggregate stats
  const total = metrics.length;
  const countMatch = (key: keyof Metrics) => metrics.filter((m) => m[key] === true).length;
  const avgDiff = (key: 'totalAssetValueDiff' | 'totalLiabilityDiff') =>
    metrics.reduce((sum, m) => sum + m[key], 0) / total;

  console.log(`Client count match:    ${countMatch('clientCountMatch')}/${total} (${(countMatch('clientCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Entity count match:    ${countMatch('entityCountMatch')}/${total} (${(countMatch('entityCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Asset count match:     ${countMatch('personalAssetCountMatch')}/${total} (${(countMatch('personalAssetCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Liability count match: ${countMatch('liabilityCountMatch')}/${total} (${(countMatch('liabilityCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Goal count match:      ${countMatch('goalCountMatch')}/${total} (${(countMatch('goalCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Family count match:    ${countMatch('familyCountMatch')}/${total} (${(countMatch('familyCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Relationship match:    ${countMatch('relationshipCountMatch')}/${total} (${(countMatch('relationshipCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Estate count match:    ${countMatch('estateCountMatch')}/${total} (${(countMatch('estateCountMatch')/total*100).toFixed(0)}%)`);
  console.log(`Super balance match:   ${countMatch('superBalanceMatch')}/${total} (${(countMatch('superBalanceMatch')/total*100).toFixed(0)}%)`);
  console.log(`Age match:             ${countMatch('ageMatch')}/${total} (${(countMatch('ageMatch')/total*100).toFixed(0)}%)`);
  console.log(`Income match:          ${countMatch('incomeMatch')}/${total} (${(countMatch('incomeMatch')/total*100).toFixed(0)}%)`);
  console.log(`Risk profile match:    ${countMatch('riskProfileMatch')}/${total} (${(countMatch('riskProfileMatch')/total*100).toFixed(0)}%)`);
  console.log(`Avg asset value diff:  ${avgDiff('totalAssetValueDiff').toFixed(1)}%`);
  console.log(`Avg liability diff:    ${avgDiff('totalLiabilityDiff').toFixed(1)}%`);
  console.log(`Avg time per file:     ${(elapsed / total).toFixed(0)}ms`);

  // Show failures
  const failures = metrics.filter((m) => !m.passed);
  if (failures.length > 0) {
    console.log(`\nFAILURES (${failures.length}):`);
    for (const f of failures) {
      console.log(`  ${f.file}: ${f.issues.join(', ')}`);
    }
  }
}

function sumAssetValues(plan: any): number {
  let total = 0;
  for (const a of plan.personalAssets || []) {
    if (a.value && a.type !== 'insurance') total += a.value;
  }
  for (const e of plan.entities || []) {
    for (const a of e.assets || []) {
      if (a.value && a.type !== 'insurance') total += a.value;
    }
  }
  return total;
}

function sumLiabilityAmounts(plan: any): number {
  let total = 0;
  for (const l of plan.personalLiabilities || []) {
    if (l.amount) total += l.amount;
  }
  for (const e of plan.entities || []) {
    for (const l of e.liabilities || []) {
      if (l.amount) total += l.amount;
    }
  }
  return total;
}

runBatch().catch(console.error);
