import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';
import { parseGoals } from '../server/src/services/local/sections/goals.js';
import { parsePersonalDetails } from '../server/src/services/local/sections/personalDetails.js';

const dir = 'client_files/Avril clients';
const tests = [76, 77, 78, 80, 81, 82];

async function main() {
  for (const num of tests) {
    const file = readFileSync(`${dir}/Client Fact Find Report - Mind Map TEST (${num}).docx`);
    const { value: text } = await mammoth.extractRawText({ buffer: file });
    const sections = splitSections(text);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST ${num}`);
    console.log('='.repeat(60));

    // Personal details
    const pd = parsePersonalDetails(sections.personalDetails);
    console.log('--- Personal Details ---');
    pd.forEach(p => console.log(`  ${p.fullName} | age=${p.age} | occupation="${p.occupation}"`));

    // Goals
    const goals = parseGoals(sections.goals);
    console.log(`--- Goals (${goals.length}) ---`);
    goals.forEach(g => console.log(`  [${g.category}] "${g.name}" | detail="${(g.detail || '').substring(0, 60)}" | tf="${g.timeframe}"`));

    // Also show raw goals cells for context
    if (sections.goals) {
      const gCells = splitCells(sections.goals);
      const dataStart = gCells.findIndex(c => /^Goal$/i.test(c));
      if (dataStart >= 0) {
        console.log('--- Goals data cells ---');
        gCells.slice(dataStart + 3).forEach((c, i) => console.log(`  [${i}] "${c.substring(0, 80)}"`));
      }
    }
  }
}
main();
