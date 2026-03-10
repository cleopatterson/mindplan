import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

const targets = [55, 21];

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

    console.log("\n" + "=".repeat(60));
    console.log(`TEST (${n})`);
    console.log("=".repeat(60));

    console.log(`\nLocal personal assets (${plan.personalAssets.length}) vs Gold (${gd?.personalAssets?.length || 0}):`);

    // Show local
    console.log("\nLOCAL:");
    for (const a of plan.personalAssets) {
      console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    }

    console.log("\nGOLD:");
    for (const a of (gd?.personalAssets || [])) {
      console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    }

    // Show entity assets too
    for (const e of plan.entities) {
      if (e.assets.length > 0) {
        console.log(`\nLocal entity '${e.name}' assets (${e.assets.length}):`);
        for (const a of e.assets) console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
      }
    }
    if (gd) {
      for (const e of gd.entities) {
        if (e.assets.length > 0) {
          console.log(`\nGold entity '${e.name}' assets (${e.assets.length}):`);
          for (const a of e.assets) console.log(`  ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
        }
      }
    }

    // Calculate totals
    let localTotal = 0, goldTotal = 0;
    for (const a of plan.personalAssets) if (a.value) localTotal += a.value;
    for (const e of plan.entities) for (const a of e.assets) if (a.value) localTotal += a.value;
    if (gd) {
      for (const a of gd.personalAssets) if (a.value) goldTotal += a.value;
      for (const e of gd.entities) for (const a of e.assets) if (a.value) goldTotal += a.value;
    }
    console.log(`\nTotals: Local=$${localTotal.toLocaleString()} Gold=$${goldTotal.toLocaleString()} Diff=${goldTotal > 0 ? ((Math.abs(localTotal-goldTotal)/goldTotal)*100).toFixed(1) : 0}%`);
  }
}

run().catch(console.error);
