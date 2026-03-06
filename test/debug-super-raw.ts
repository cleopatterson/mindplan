import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  for (const n of [55, 3, 21, 1, 16, 2]) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const buf = fs.readFileSync(path.join(clientDir, fname));
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    
    if (sections.superannuation) {
      console.log(`\n=== TEST (${n}) SUPER section cells ===`);
      const cells = splitCells(sections.superannuation);
      for (let i = 0; i < cells.length; i++) {
        console.log(`  [${i}] "${cells[i]}"`);
      }
    }
  }
}
run().catch(console.error);
