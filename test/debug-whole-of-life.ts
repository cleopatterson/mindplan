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
    const buf = fs.readFileSync(path.join(clientDir, fname));
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    if (!sections.insurance) continue;
    
    const cells = splitCells(sections.insurance);
    for (const cell of cells) {
      if (/whole\s*of\s*life/i.test(cell)) {
        const n = fname.match(/TEST \((\d+)\)/)?.[1];
        console.log(`TEST (${n}): "${cell}"`);
        break;
      }
    }
  }
}
run().catch(console.error);
