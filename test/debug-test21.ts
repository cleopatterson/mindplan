import mammoth from 'mammoth';
import fs from 'fs';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

async function main() {
  const buf = fs.readFileSync('/Users/tonywall/Desktop/MindPlan/client_files/Client Fact Find Report - Mind Map TEST (61).docx');
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(text);
  const plan = assemble(sections);

  console.log('=== LOCAL PARSER ===');
  console.log('Clients:', plan.clients.map(c => `${c.firstName} ${c.lastName} age:${c.age} super:${c.superBalance}`));
  console.log('\nEntities:', plan.entities.length);
  for (const e of plan.entities) {
    console.log(' ', e.name, 'type:' + e.type);
    for (const a of e.assets) console.log('    asset:', a.name, 'type:' + a.type, 'val:' + a.value);
  }
  console.log('\nPersonal Assets:', plan.personalAssets.length);
  for (const a of plan.personalAssets) {
    console.log(' ', a.name, 'type:' + a.type, 'val:' + a.value, 'owners:' + JSON.stringify(a.ownerIds));
  }
  console.log('\nPersonal Liabilities:', plan.personalLiabilities.length);
  for (const l of plan.personalLiabilities) {
    console.log(' ', l.name, 'type:' + l.type, 'amt:' + l.amount);
  }

  // Show key sections in full
  console.log('\n=== ENTITY HOLDINGS (full) ===');
  console.log(sections.entityHoldings);
  console.log('\n=== BANK ACCOUNTS (full) ===');
  console.log(sections.bankAccounts);
  console.log('\n=== LOANS (full) ===');
  console.log(sections.loans);
  console.log('\n=== SUPERANNUATION (full) ===');
  console.log(sections.superannuation);
}

main().catch(console.error);
