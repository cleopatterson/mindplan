import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  for (const n of [69, 50]) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;

    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);

    console.log("=".repeat(60));
    console.log(`TEST (${n}) — Insurance section`);
    console.log("=".repeat(60));

    if (sections.insurance) {
      const cells = splitCells(sections.insurance);
      const coverIdx = cells.findIndex(c => /^Cover amount$/i.test(c));
      const dataCells = cells.slice(coverIdx + 1);
      
      for (let i = 0; i < dataCells.length; i++) {
        const c = dataCells[i];
        const flags: string[] = [];
        if (/^[\-\(]?\$/.test(c)) flags.push("$$$");
        if (/per\s*month/i.test(c)) flags.push("MONTHLY");
        if (/income\s*prot/i.test(c)) flags.push("IP");
        console.log(`  [${i}] "${c}" ${flags.join(' ')}`);
      }
    } else {
      console.log("  NO insurance section");
    }
  }
}
run().catch(console.error);
