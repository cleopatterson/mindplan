import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

async function run() {
  const n = 6;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  console.log("Local insurance:");
  for (const a of plan.personalAssets.filter((a: any) => a.type === 'insurance')) {
    console.log(`  ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  console.log("\nGold insurance:");
  for (const a of (gd?.personalAssets || []).filter((a: any) => a.type === 'insurance')) {
    console.log(`  ${a.name} | $${(a.value||0).toLocaleString()}`);
  }
  
  // Show insurance section raw cells
  if (sections.insurance) {
    console.log("\n=== Insurance section raw cells ===");
    const cells = splitCells(sections.insurance);
    for (let i = 0; i < cells.length; i++) {
      console.log(`  [${i}] "${cells[i]}"`);
    }
  }
}
run().catch(console.error);
