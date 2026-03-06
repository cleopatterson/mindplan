import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

// Check how many files have insurance policies with "superannuation" in name
async function run() {
  const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.docx'));
  for (const fname of files) {
    const buf = fs.readFileSync(path.join(clientDir, fname));
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    if (!sections.insurance) continue;
    
    const cells = splitCells(sections.insurance);
    const headerIdx = cells.findIndex(c => /^Cover amount$/i.test(c));
    if (headerIdx < 0) continue;
    
    const dataCells = cells.slice(headerIdx + 1);
    const superPolicies = dataCells.filter(c => 
      /superannuation/i.test(c) && !/^Premium|^Type:|^Waiting|^Benefit|^Features/i.test(c)
    );
    
    if (superPolicies.length > 0) {
      const n = fname.match(/TEST \((\d+)\)/)?.[1];
      for (const p of superPolicies) {
        console.log(`TEST (${n}): "${p}"`);
      }
    }
  }
}
run().catch(console.error);
