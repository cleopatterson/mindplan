import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

// Find all files with "(per month)" in insurance section
async function run() {
  const files = fs.readdirSync(clientDir).filter(f => f.endsWith('.docx'));
  
  for (const fname of files) {
    const fpath = path.join(clientDir, fname);
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    
    if (!sections.insurance) continue;
    const cells = splitCells(sections.insurance);
    
    // Check for "(per month)"
    const monthlyIdx = cells.findIndex(c => /per\s*month/i.test(c));
    if (monthlyIdx < 0) continue;
    
    const testNum = fname.match(/TEST \((\d+)\)/)?.[1] || fname;
    
    // Find the amounts after each "(per month)"
    for (let i = 0; i < cells.length; i++) {
      if (/per\s*month/i.test(cells[i])) {
        // Find next dollar amount
        for (let j = i + 1; j < cells.length && j < i + 10; j++) {
          if (/^[\-\(]?\$/.test(cells[j])) {
            console.log(`TEST (${testNum}): "${cells[i]}" → ${cells[j]}/month (annual: $${(parseFloat(cells[j].replace(/[$,\(\)]/g, '')) * 12).toLocaleString()})`);
            break;
          }
        }
      }
    }
  }
}
run().catch(console.error);
