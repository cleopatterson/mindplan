import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.docx'));
  
  for (const fname of files) {
    const fpath = path.join(clientDir, fname);
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    
    if (!sections.insurance) continue;
    const cells = splitCells(sections.insurance);

    for (const c of cells) {
      if (/buyback|reinstatement/i.test(c)) {
        const testNum = fname.match(/TEST \((\d+)\)/)?.[1] || fname;
        console.log(`TEST (${testNum}): "${c}"`);
      }
    }
  }
}
run().catch(console.error);
