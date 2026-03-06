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
  const fpath = path.join(clientDir, fname);
  const buf = fs.readFileSync(fpath);
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gold = goldData.find((g: any) => g.file.includes(`TEST (${n})`));
  const gd = gold?.data;

  console.log("LOCAL personal assets:");
  for (const a of plan.personalAssets) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }

  console.log("\nGOLD personal assets:");
  for (const a of (gd?.personalAssets || [])) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }

  // Entity comparison
  console.log("\nLOCAL entities:");
  for (const e of plan.entities) {
    const aTotal = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.assets.length} assets, total $${aTotal.toLocaleString()})`);
  }
  console.log("\nGOLD entities:");
  for (const e of (gd?.entities || [])) {
    const aTotal = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.assets.length} assets, total $${aTotal.toLocaleString()})`);
  }

  // Total
  let localTotal = 0, goldTotal = 0;
  for (const a of plan.personalAssets) if (a.value) localTotal += a.value;
  for (const e of plan.entities) for (const a of e.assets) if (a.value) localTotal += a.value;
  if (gd) {
    for (const a of gd.personalAssets) if (a.value) goldTotal += a.value;
    for (const e of gd.entities) for (const a of e.assets) if (a.value) goldTotal += a.value;
  }
  console.log(`\nTotals: local=$${localTotal.toLocaleString()} gold=$${goldTotal.toLocaleString()} diff=${((Math.abs(localTotal-goldTotal)/goldTotal)*100).toFixed(1)}%`);
}
run().catch(console.error);
