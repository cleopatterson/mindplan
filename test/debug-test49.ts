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
  const n = 49;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;

  console.log("LOCAL personal assets:");
  for (const a of plan.personalAssets) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()} | details: ${a.details || ''}`);
  }
  console.log("\nGOLD personal assets:");
  for (const a of (gd?.personalAssets || [])) {
    console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }

  // Show entities
  console.log("\nLOCAL entities:");
  for (const e of plan.entities) {
    const t = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.assets.length} assets, total $${t.toLocaleString()})`);
    for (const a of e.assets) console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  console.log("\nGOLD entities:");
  for (const e of (gd?.entities || [])) {
    const t = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.assets.length} assets, total $${t.toLocaleString()})`);
    for (const a of e.assets) console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
  }

  // Show value by type
  console.log("\nValue by type:");
  const localByType: Record<string, number> = {};
  const goldByType: Record<string, number> = {};
  for (const a of plan.personalAssets) localByType[a.type] = (localByType[a.type] || 0) + (a.value || 0);
  for (const a of (gd?.personalAssets || [])) goldByType[a.type] = (goldByType[a.type] || 0) + (a.value || 0);

  for (const type of new Set([...Object.keys(localByType), ...Object.keys(goldByType)])) {
    const l = localByType[type] || 0;
    const g = goldByType[type] || 0;
    if (l !== g) console.log(`  ${type}: local=$${l.toLocaleString()} gold=$${g.toLocaleString()} diff=$${(l-g).toLocaleString()}`);
    else console.log(`  ${type}: $${l.toLocaleString()} (match)`);
  }
}
run().catch(console.error);
