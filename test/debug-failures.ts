import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

// All failing test numbers
const targets = [1, 3, 6, 14, 21, 23, 24, 25, 30, 47, 49, 50, 55, 59, 61, 64, 69];

async function run() {
  for (const n of targets) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) { console.log("SKIP:", fname); continue; }

    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    const plan = assemble(sections);

    const gold = goldData.find((g: any) => g.file.includes(`TEST (${n})`));
    const gd = gold?.data;

    console.log("\n" + "=".repeat(70));
    console.log(`TEST (${n}) — Local PA: ${plan.personalAssets.length} vs Gold PA: ${gd?.personalAssets?.length || 0} | Entities: ${plan.entities.length} vs ${gd?.entities?.length || 0}`);
    console.log("=".repeat(70));

    // Show asset type counts comparison
    const localByType: Record<string, any[]> = {};
    const goldByType: Record<string, any[]> = {};
    for (const a of plan.personalAssets) (localByType[a.type] ||= []).push(a);
    for (const a of (gd?.personalAssets || [])) (goldByType[a.type] ||= []).push(a);

    const allTypes = new Set([...Object.keys(localByType), ...Object.keys(goldByType)]);
    for (const type of [...allTypes].sort()) {
      const lc = localByType[type]?.length || 0;
      const gc = goldByType[type]?.length || 0;
      const diff = lc !== gc ? ` *** DIFF (${lc > gc ? '+' : ''}${lc - gc})` : '';
      if (diff) {
        console.log(`  ${type}: local=${lc} gold=${gc}${diff}`);
        console.log('    LOCAL:');
        for (const a of (localByType[type] || [])) {
          console.log(`      ${a.name} | $${(a.value||0).toLocaleString()}`);
        }
        console.log('    GOLD:');
        for (const a of (goldByType[type] || [])) {
          console.log(`      ${a.name} | $${(a.value||0).toLocaleString()}`);
        }
      }
    }

    // Show value totals
    let localTotal = 0, goldTotal = 0;
    for (const a of plan.personalAssets) if (a.value) localTotal += a.value;
    for (const e of plan.entities) for (const a of e.assets) if (a.value) localTotal += a.value;
    if (gd) {
      for (const a of gd.personalAssets) if (a.value) goldTotal += a.value;
      for (const e of gd.entities) for (const a of e.assets) if (a.value) goldTotal += a.value;
    }
    const pct = goldTotal > 0 ? ((Math.abs(localTotal-goldTotal)/goldTotal)*100).toFixed(1) : '0';
    console.log(`  TOTALS: local=$${localTotal.toLocaleString()} gold=$${goldTotal.toLocaleString()} diff=${pct}%`);

    // Show entity diff if counts differ
    if (plan.entities.length !== (gd?.entities?.length || 0)) {
      const localNames = plan.entities.map((e: any) => e.name);
      const goldNames = (gd?.entities || []).map((e: any) => e.name);
      const missing = goldNames.filter((n: string) => !localNames.some((ln: string) => ln.toLowerCase().includes(n.toLowerCase().slice(0, 10))));
      const extra = localNames.filter((n: string) => !goldNames.some((gn: string) => n.toLowerCase().includes(gn.toLowerCase().slice(0, 10))));
      if (missing.length) console.log(`  MISSING entities: ${missing.join(', ')}`);
      if (extra.length) console.log(`  EXTRA entities: ${extra.join(', ')}`);
    }
  }
}
run().catch(console.error);
