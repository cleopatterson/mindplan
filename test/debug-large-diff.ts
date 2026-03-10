import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

async function debugFile(n: number) {
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  const localTotal = plan.personalAssets.reduce((s: number, a: any) => s + (a.value || 0), 0);
  const goldTotal = (gd?.personalAssets || []).reduce((s: number, a: any) => s + (a.value || 0), 0);
  
  console.log(`\n=== TEST (${n}) ===`);
  console.log(`Local assets: ${plan.personalAssets.length}, Gold assets: ${(gd?.personalAssets||[]).length}`);
  console.log(`Local total: $${localTotal.toLocaleString()}, Gold total: $${goldTotal.toLocaleString()}`);
  console.log(`Diff: $${(localTotal - goldTotal).toLocaleString()} (${((Math.abs(localTotal - goldTotal) / goldTotal) * 100).toFixed(1)}%)`);
  
  // Find assets in local but not in gold (by type+value)
  const goldSet = new Set((gd?.personalAssets || []).map((a: any) => `${a.type}|${a.value}`));
  const localSet = new Set(plan.personalAssets.map((a: any) => `${a.type}|${a.value}`));
  
  console.log(`\nLocal assets NOT in gold (by type|value):`);
  for (const a of plan.personalAssets) {
    const key = `${a.type}|${a.value}`;
    if (!goldSet.has(key)) {
      console.log(`  + ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    }
  }
  
  console.log(`\nGold assets NOT in local (by type|value):`);
  for (const a of (gd?.personalAssets || [])) {
    const key = `${a.type}|${a.value}`;
    if (!localSet.has(key)) {
      console.log(`  - ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    }
  }
}

async function run() {
  for (const n of [25, 30, 50, 64, 21, 23]) {
    await debugFile(n);
  }
}
run().catch(console.error);
