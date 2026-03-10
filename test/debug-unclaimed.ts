import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { parseEntityStructure } from '../server/src/services/local/sections/entityStructure.js';
import { parseEntityHoldings } from '../server/src/services/local/sections/entityHoldings.js';
import { normalizeName } from '../server/src/services/local/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

const targets = [59, 61, 24];

async function run() {
  for (const n of targets) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;

    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);

    const structures = parseEntityStructure(sections.entityStructure);
    const holdings = parseEntityHoldings(sections.entityHoldings);

    console.log("\n" + "=".repeat(60));
    console.log(`TEST (${n})`);

    console.log("\nEntity structures:");
    for (const s of structures) {
      console.log(`  ${s.name} [${s.type}]`);
    }

    console.log("\nEntity holdings groups:");
    const structureKeys = new Set(structures.map(s => normalizeName(s.name).toLowerCase()));
    for (const h of holdings) {
      const key = normalizeName(h.entityName).toLowerCase();
      const status = structureKeys.has(key) ? "MATCHED" : "UNCLAIMED";
      console.log(`  "${h.entityName}" → ${status} (${h.assets.length} assets, ${h.liabilities.length} liabilities)`);
      if (status === "UNCLAIMED") {
        for (const a of h.assets) {
          console.log(`    asset: ${a.description} | ${a.type} | $${(a.amount||0).toLocaleString()}`);
        }
      }
    }
  }
}
run().catch(console.error);
