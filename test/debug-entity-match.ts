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

async function run() {
  const n = 49;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);

  const structures = parseEntityStructure(sections.entityStructure);
  const holdings = parseEntityHoldings(sections.entityHoldings);

  console.log("Entity STRUCTURES (key = normalized lowercase):");
  for (const s of structures) {
    const key = normalizeName(s.name).toLowerCase();
    console.log(`  "${s.name}" → key: "${key}"`);
  }

  console.log("\nEntity HOLDINGS (key = normalized lowercase):");
  for (const h of holdings) {
    const key = normalizeName(h.entityName).toLowerCase();
    console.log(`  "${h.entityName}" → key: "${key}" (${h.assets.length} assets)`);
  }

  // Check for unmatched holdings
  const structKeys = new Set(structures.map(s => normalizeName(s.name).toLowerCase()));
  for (const h of holdings) {
    const hKey = normalizeName(h.entityName).toLowerCase();
    if (!structKeys.has(hKey)) {
      // Check fuzzy match
      let fuzzy = false;
      for (const sk of structKeys) {
        if (sk.endsWith(hKey) || hKey.endsWith(sk)) {
          fuzzy = true;
          console.log(`  FUZZY MATCH: holdings "${hKey}" <-> structure "${sk}"`);
        }
      }
      if (!fuzzy) {
        console.log(`  UNMATCHED: "${hKey}" (${h.assets.length} assets)`);
      }
    }
  }
}
run().catch(console.error);
