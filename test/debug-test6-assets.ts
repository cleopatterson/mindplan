import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

async function run() {
  const filePath = path.join(__dirname, '..', 'client_files', 'Client Fact Find Report - Mind Map TEST (6).docx');
  const buf = fs.readFileSync(filePath);
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);
  
  console.log('Clients:', JSON.stringify(plan.clients.map((c: any) => c.name), null, 2));
  console.log('Personal Assets:');
  console.log(JSON.stringify(plan.personalAssets, null, 2));
  
  // Also show entity holdings
  console.log('\nEntity Holdings:');
  console.log(JSON.stringify(plan.entityHoldings, null, 2));
}

run().catch((e: any) => console.error(e));
