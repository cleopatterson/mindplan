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
  console.log(`Local: ${plan.personalAssets.length} assets, $${localTotal.toLocaleString()}`);
  console.log(`Gold:  ${(gd?.personalAssets||[]).length} assets, $${goldTotal.toLocaleString()}`);
  console.log(`Diff:  $${(localTotal - goldTotal).toLocaleString()} (${((Math.abs(localTotal - goldTotal) / goldTotal) * 100).toFixed(1)}%)`);
  
  // Show ALL assets side by side grouped by type
  const localByType: Record<string, any[]> = {};
  const goldByType: Record<string, any[]> = {};
  for (const a of plan.personalAssets) (localByType[a.type] ??= []).push(a);
  for (const a of (gd?.personalAssets || [])) (goldByType[a.type] ??= []).push(a);
  
  const allTypes = new Set([...Object.keys(localByType), ...Object.keys(goldByType)]);
  for (const type of allTypes) {
    const la = localByType[type] || [];
    const ga = goldByType[type] || [];
    const lt = la.reduce((s: number, a: any) => s + (a.value || 0), 0);
    const gt = ga.reduce((s: number, a: any) => s + (a.value || 0), 0);
    if (lt !== gt || la.length !== ga.length) {
      console.log(`\n  ${type}: local ${la.length} ($${lt.toLocaleString()}) vs gold ${ga.length} ($${gt.toLocaleString()})`);
      for (const a of la) console.log(`    L: ${a.name} = $${(a.value||0).toLocaleString()}`);
      for (const a of ga) console.log(`    G: ${a.name} = $${(a.value||0).toLocaleString()}`);
    }
  }
  
  // Also check entities
  const localEntTotal = plan.entities.reduce((s: number, e: any) => s + e.assets.reduce((s2: number, a: any) => s2 + (a.value || 0), 0), 0);
  const goldEntTotal = (gd?.entities || []).reduce((s: number, e: any) => s + e.assets.reduce((s2: number, a: any) => s2 + (a.value || 0), 0), 0);
  if (localEntTotal !== goldEntTotal || plan.entities.length !== (gd?.entities||[]).length) {
    console.log(`\n  Entities: local ${plan.entities.length} ($${localEntTotal.toLocaleString()}) vs gold ${(gd?.entities||[]).length} ($${goldEntTotal.toLocaleString()})`);
    for (const e of plan.entities) {
      const et = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
      console.log(`    L: ${e.name} (${e.assets.length} assets, $${et.toLocaleString()})`);
    }
    for (const e of (gd?.entities || [])) {
      const et = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
      console.log(`    G: ${e.name} (${e.assets.length} assets, $${et.toLocaleString()})`);
    }
  }
}

async function run() {
  for (const n of [55, 69, 14, 1, 3, 6]) {
    await debugFile(n);
  }
}
run().catch(console.error);
