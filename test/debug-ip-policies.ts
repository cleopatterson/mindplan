import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

// Find all "Income Protection" cells that also have " - " (potential named policies)
async function run() {
  const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.docx'));
  
  for (const fname of files) {
    const fpath = path.join(clientDir, fname);
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    
    if (!sections.insurance) continue;
    const cells = splitCells(sections.insurance);
    const coverIdx = cells.findIndex(c => /^Cover amount$/i.test(c));
    if (coverIdx < 0) continue;
    const dataCells = cells.slice(coverIdx + 1);

    for (let i = 0; i < dataCells.length; i++) {
      const c = dataCells[i].trim();
      // Cover type with " - " → potential named policy
      if (/^(income protection|life cover|tpd cover|trauma)/i.test(c) && /\s-\s/.test(c)) {
        const testNum = fname.match(/TEST \((\d+)\)/)?.[1] || fname;
        console.log(`TEST (${testNum}): [${i}] "${c}" (${c.length} chars)`);
      }
    }
  }
}
run().catch(console.error);
