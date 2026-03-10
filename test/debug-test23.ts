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
  const n = 23;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  let localTotal = plan.personalAssets.reduce((s: number, a: any) => s + (a.value || 0), 0);
  let goldTotal = (gd?.personalAssets || []).reduce((s: number, a: any) => s + (a.value || 0), 0);
  for (const e of plan.entities) for (const a of e.assets) localTotal += a.value || 0;
  for (const e of (gd?.entities || [])) for (const a of e.assets) goldTotal += a.value || 0;
  
  console.log(`Total: local $${localTotal.toLocaleString()} vs gold $${goldTotal.toLocaleString()} (${((Math.abs(localTotal-goldTotal)/goldTotal)*100).toFixed(1)}%)`);
  
  console.log("\nLocal insurance:");
  for (const a of plan.personalAssets.filter((a: any) => a.type === 'insurance')) {
    console.log(`  ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  console.log("\nGold insurance:");
  for (const a of (gd?.personalAssets || []).filter((a: any) => a.type === 'insurance')) {
    console.log(`  ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  
  // Show non-insurance differences
  const localNonIns = plan.personalAssets.filter((a: any) => a.type !== 'insurance');
  const goldNonIns = (gd?.personalAssets || []).filter((a: any) => a.type !== 'insurance');
  console.log(`\nNon-insurance: local ${localNonIns.length} vs gold ${goldNonIns.length}`);
}
run().catch(console.error);
