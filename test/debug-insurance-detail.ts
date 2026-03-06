import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';
import { parseInsurance } from '../server/src/services/local/sections/insurance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

async function run() {
  for (const n of [14, 21]) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;

    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);

    console.log("=".repeat(60));
    console.log(`TEST (${n}) — Insurance`);
    console.log("=".repeat(60));

    if (sections.insurance) {
      const cells = splitCells(sections.insurance);
      const coverIdx = cells.findIndex(c => /^Cover amount$/i.test(c));
      const dataCells = cells.slice(coverIdx + 1);

      console.log("\nRaw cells:");
      for (let i = 0; i < dataCells.length; i++) {
        const c = dataCells[i];
        const flags: string[] = [];
        if (/^[\-\(]?\$/.test(c)) flags.push("$$$");
        if (/life cover|tpd cover|trauma|income protection/i.test(c)) flags.push("COVER_TYPE");
        if (/premium type|waiting period|benefit period|features|tpd definition|type:/i.test(c)) flags.push("FEATURE");
        console.log(`  [${i}] "${c}" ${flags.join(' ')}`);
      }

      console.log("\nParsed items:");
      const items = parseInsurance(sections.insurance);
      for (const item of items) {
        console.log(`  ${item.name} | ${item.insuredPerson} | $${(item.coverAmount||0).toLocaleString()}`);
      }
    }
  }
}
run().catch(console.error);
