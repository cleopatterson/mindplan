import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { parseEntityHoldings } from '../server/src/services/local/sections/entityHoldings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

const targets = [29, 56, 59];

async function run() {
  for (const n of targets) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;

    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);

    console.log("\n" + "=".repeat(60));
    console.log(`TEST (${n}) — Entity Holdings Section`);
    console.log("=".repeat(60));

    if (sections.entityHoldings) {
      // Show raw section text (first 3000 chars)
      console.log("\nRaw section text:");
      console.log(sections.entityHoldings.slice(0, 3000));
      console.log("...");

      // Parse and show results
      const holdings = parseEntityHoldings(sections.entityHoldings);
      console.log("\nParsed entity holdings:");
      for (const h of holdings) {
        console.log(`\n  Entity: '${h.entityName}'`);
        console.log(`  Assets (${h.assets.length}):`);
        for (const a of h.assets) {
          console.log(`    ${a.type} | ${a.description} | $${(a.amount || 0).toLocaleString()} [raw: ${a.rawType}]`);
        }
        if (h.liabilities.length > 0) {
          console.log(`  Liabilities (${h.liabilities.length}):`);
          for (const l of h.liabilities) {
            console.log(`    ${l.description} | $${(l.amount || 0).toLocaleString()}`);
          }
        }
      }
    } else {
      console.log("NO entity holdings section found");
    }
  }
}

run().catch(console.error);
