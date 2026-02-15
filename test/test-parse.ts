import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { parseWithClaude } from '../server/src/services/claude.js';
import { enrichGaps } from '../server/src/services/validator.js';

const sampleText = fs.readFileSync(path.join(__dirname, 'sample-plan.txt'), 'utf-8');

async function main() {
  console.log(`Sending ${sampleText.length} chars to Claude...`);
  console.time('parse');

  try {
    const plan = await parseWithClaude(sampleText);
    enrichGaps(plan);
    console.timeEnd('parse');

    console.log('\n=== RESULTS ===');
    console.log(`Clients: ${plan.clients.length}`);
    for (const c of plan.clients) {
      console.log(`  - ${c.name}, age ${c.age}, income $${c.income}`);
    }
    console.log(`Entities: ${plan.entities.length}`);
    for (const e of plan.entities) {
      console.log(`  - ${e.name} (${e.type}) — ${e.assets.length} assets, ${e.liabilities.length} liabilities`);
    }
    console.log(`Personal assets: ${plan.personalAssets.length}`);
    console.log(`Personal liabilities: ${plan.personalLiabilities.length}`);
    console.log(`Objectives: ${plan.objectives.length}`);
    console.log(`Data gaps: ${plan.dataGaps.length}`);
    for (const g of plan.dataGaps) {
      console.log(`  - ${g.description}`);
    }

    // Write full JSON for inspection
    fs.writeFileSync(path.join(__dirname, 'output.json'), JSON.stringify(plan, null, 2));
    console.log('\nFull JSON written to test/output.json');
  } catch (err) {
    console.timeEnd('parse');
    console.error('ERROR:', err);
  }
}

main();
