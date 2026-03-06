import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  const fname = 'Client Fact Find Report - Mind Map TEST (49).docx';
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);

  if (!sections.entityHoldings) { console.log("No entity holdings"); return; }

  const cells = splitCells(sections.entityHoldings);
  const headerIdx = cells.findIndex(c => /^Description$/i.test(c));
  console.log("Header at:", headerIdx);

  const dataStart = headerIdx + 3;
  const dataCells = cells.slice(dataStart);

  // Show first 40 cells with indices
  for (let i = 0; i < Math.min(40, dataCells.length); i++) {
    const c = dataCells[i];
    const flags: string[] = [];
    if (/^[\-\(]?\$/.test(c)) flags.push("$$$");
    if (/^total$/i.test(c)) flags.push("TOTAL");

    // Check isKnownAssetType
    const t = c.trim().toLowerCase();
    if (/everyday\s*cash/i.test(c) || /savings/i.test(c) || /on-?line\s*saver/i.test(c) ||
        /term\s*deposit/i.test(c) || /loan\s*offset/i.test(c) || /investment\s*portfolio/i.test(c) ||
        /residential\s*(property|unit|home)/i.test(c) || /commercial\s*property/i.test(c) ||
        /holiday\s*home/i.test(c) || /\bland\b/i.test(c) || /\bbusiness\b/i.test(c) ||
        /listed\s*on\s*asx/i.test(c) || /listed\s*\(other/i.test(c) || /unlisted/i.test(c) ||
        /property/i.test(c) || t === 'car' || t === 'boat') {
      flags.push("TYPE");
    }

    console.log(`  [${i}] "${c}" ${flags.join(' ')}`);
  }
}

run().catch(console.error);
