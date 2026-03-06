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
  const n = 16;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  const localTotal = plan.personalAssets.reduce((s: number, a: any) => s + (a.value || 0), 0);
  const goldTotal = (gd?.personalAssets || []).reduce((s: number, a: any) => s + (a.value || 0), 0);
  
  console.log(`Local: ${plan.personalAssets.length} assets, $${localTotal.toLocaleString()}`);
  console.log(`Gold:  ${(gd?.personalAssets||[]).length} assets, $${goldTotal.toLocaleString()}`);
  console.log(`Diff:  $${(localTotal - goldTotal).toLocaleString()} (${((Math.abs(localTotal - goldTotal) / goldTotal) * 100).toFixed(1)}%)`);
  
  console.log(`\nLocal assets:`);
  for (const a of plan.personalAssets) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  console.log(`\nGold assets:`);
  for (const a of (gd?.personalAssets || [])) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
}
run().catch(console.error);

async function run2() {
  const n = 16;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  console.log("\nEntities (local):");
  for (const e of plan.entities) {
    const et = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.type}, ${e.assets.length} assets, $${et.toLocaleString()})`);
    for (const a of e.assets) console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  
  console.log("\nEntities (gold):");
  for (const e of (gd?.entities || [])) {
    const et = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.type}, ${e.assets.length} assets, $${et.toLocaleString()})`);
    for (const a of e.assets) console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  
  // Total asset values
  let localTotal = plan.personalAssets.reduce((s: number, a: any) => s + (a.value || 0), 0);
  let goldTotal = (gd?.personalAssets || []).reduce((s: number, a: any) => s + (a.value || 0), 0);
  for (const e of plan.entities) for (const a of e.assets) localTotal += (a.value || 0);
  for (const e of (gd?.entities || [])) for (const a of e.assets) goldTotal += (a.value || 0);
  
  console.log(`\nTotal (personal+entity): local $${localTotal.toLocaleString()}, gold $${goldTotal.toLocaleString()}`);
  console.log(`Diff: ${((Math.abs(localTotal - goldTotal) / goldTotal) * 100).toFixed(1)}%`);
}
run2().catch(console.error);
