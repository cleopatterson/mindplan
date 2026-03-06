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
  const n = 69;
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const buf = fs.readFileSync(path.join(clientDir, fname));
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  
  console.log(`LOCAL goals (${plan.goals.length}):`);
  for (const g of plan.goals) {
    console.log(`  [${g.category}] "${g.name}" | detail: "${g.detail || ''}" | timeframe: ${g.timeframe || 'none'}`);
  }
  
  console.log(`\nGOLD goals (${(gd?.goals || []).length}):`);
  for (const g of (gd?.goals || [])) {
    console.log(`  [${g.category}] "${g.name}" | detail: "${g.detail || ''}" | timeframe: ${g.timeframe || 'none'}`);
  }

  // Show raw goals section cells
  if (sections.goals) {
    console.log("\n=== Raw goals section cells ===");
    const cells = splitCells(sections.goals);
    for (let i = 0; i < cells.length; i++) {
      console.log(`  [${i}] "${cells[i]}"`);
    }
  }
}
run().catch(console.error);
