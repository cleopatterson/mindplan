import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  // Check TEST 69 insurance raw cells for "per month" or monthly indicators
  for (const n of [69, 25, 30, 14, 50]) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const buf = fs.readFileSync(path.join(clientDir, fname));
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    if (!sections.insurance) continue;
    
    const cells = splitCells(sections.insurance);
    console.log(`\n=== TEST (${n}) insurance cells containing "month" or "income" ===`);
    for (let i = 0; i < cells.length; i++) {
      if (/month|income\s*prot/i.test(cells[i])) {
        // Show context: 3 cells before and after
        for (let j = Math.max(0, i-2); j <= Math.min(cells.length-1, i+3); j++) {
          const marker = j === i ? '>>>' : '   ';
          console.log(`  ${marker} [${j}] "${cells[j]}"`);
        }
        console.log('  ---');
      }
    }
  }
}
run().catch(console.error);
