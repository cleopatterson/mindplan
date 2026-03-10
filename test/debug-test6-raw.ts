import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { splitSections } from '../server/src/services/local/splitSections.js';

async function run() {
  const filePath = path.join(__dirname, '..', 'client_files', 'Client Fact Find Report - Mind Map TEST (6).docx');
  const buf = fs.readFileSync(filePath);
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);

  console.log('===== SUPERANNUATION =====');
  console.log(sections.superannuation);
  console.log('\n===== INSURANCE =====');
  console.log(sections.insurance);
  console.log('\n===== LIFESTYLE ASSETS =====');
  console.log(sections.lifestyleAssets);
  console.log('\n===== BANK ACCOUNTS =====');
  console.log(sections.bankAccounts);
  console.log('\n===== FINANCIAL INVESTMENTS =====');
  console.log(sections.financialInvestments);
  console.log('\n===== PENSION =====');
  console.log(sections.pension);
}

run().catch((e: any) => console.error(e));
