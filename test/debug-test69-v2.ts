import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

async function run() {
  const n = 69;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  // Show all assets + entity assets
  let localTotal = 0, goldTotal = 0;
  console.log("Local assets:");
  for (const a of plan.personalAssets) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    localTotal += a.value || 0;
  }
  for (const e of plan.entities) {
    for (const a of e.assets) {
      console.log(`  [${e.name}] ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
      localTotal += a.value || 0;
    }
  }
  
  console.log("\nGold assets:");
  for (const a of (gd?.personalAssets || [])) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    goldTotal += a.value || 0;
  }
  for (const e of (gd?.entities || [])) {
    for (const a of e.assets) {
      console.log(`  [${e.name}] ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
      goldTotal += a.value || 0;
    }
  }
  
  console.log(`\nTotal local: $${localTotal.toLocaleString()}, gold: $${goldTotal.toLocaleString()}`);
  console.log(`Diff: $${(localTotal - goldTotal).toLocaleString()} (${((Math.abs(localTotal - goldTotal) / goldTotal) * 100).toFixed(1)}%)`);
  
  // Income Protection: $15,458 (local) vs $185,496 (gold) = × 12
  console.log(`\n$15,458 × 12 = $${(15458 * 12).toLocaleString()}`);
}
run().catch(console.error);
