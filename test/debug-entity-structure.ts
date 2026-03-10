/**
 * Debug script: investigate missing entities in the local parser for TEST (24), (59), (61).
 *
 * Usage: npx tsx test/debug-entity-structure.ts
 * Server does NOT need to be running.
 */

import mammoth from 'mammoth';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { parseEntityStructure, inferEntityType } from '../server/src/services/local/sections/entityStructure.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_FILES = path.resolve(__dirname, '../client_files');

const TEST_FILES: { num: number; label: string; missing: string[] }[] = [
  {
    num: 24,
    label: 'TEST (24)',
    missing: [
      'CFS FirstChoice Wholesale Personal Super - Michael',
      'CFS FirstChoice Wholesale Personal Super - Elizabeth',
    ],
  },
  {
    num: 59,
    label: 'TEST (59)',
    missing: ['Piesse Investment Holdings Pty Ltd'],
  },
  {
    num: 61,
    label: 'TEST (61)',
    missing: ['Aaron and Mery Sullivan Family Trust'],
  },
];

async function extractText(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function searchTextForMissing(rawText: string, missing: string[]): void {
  for (const name of missing) {
    // Try the full name and substrings
    const idx = rawText.indexOf(name);
    if (idx >= 0) {
      const snippet = rawText.slice(Math.max(0, idx - 100), idx + name.length + 200);
      console.log(`  [FOUND in full text] "${name}" at char ${idx}`);
      console.log(`  --- context ---`);
      console.log(snippet.replace(/\n/g, '↵'));
      console.log(`  ---------------`);
    } else {
      // Try partial match (first 20 chars)
      const partial = name.slice(0, 20);
      const pidx = rawText.indexOf(partial);
      if (pidx >= 0) {
        const snippet = rawText.slice(Math.max(0, pidx - 100), pidx + partial.length + 200);
        console.log(`  [PARTIAL MATCH] "${partial}..." at char ${pidx}`);
        console.log(snippet.replace(/\n/g, '↵'));
      } else {
        console.log(`  [NOT FOUND anywhere in raw text] "${name}"`);
      }
    }
  }
}

function searchSectionForMissing(sectionText: string | null, sectionName: string, missing: string[]): void {
  if (!sectionText) {
    console.log(`  Section "${sectionName}": null (not found)`);
    return;
  }
  for (const name of missing) {
    const idx = sectionText.indexOf(name);
    if (idx >= 0) {
      console.log(`  [FOUND in ${sectionName}] "${name}"`);
    } else {
      // Try partial
      const partial = name.slice(0, 15);
      const pidx = sectionText.indexOf(partial);
      if (pidx >= 0) {
        console.log(`  [PARTIAL in ${sectionName}] "${partial}..." at offset ${pidx}`);
      } else {
        console.log(`  [ABSENT from ${sectionName}] "${name}"`);
      }
    }
  }
}

function analyzeEntityStructureSection(sectionText: string | null): void {
  if (!sectionText) {
    console.log('  entityStructure section: null');
    return;
  }

  console.log(`\n  entityStructure section (first 3000 chars):`);
  console.log('  ─'.repeat(60));
  console.log(sectionText.slice(0, 3000).replace(/\n/g, '\n  '));
  console.log('  ─'.repeat(60));

  // Now step through the parsing logic manually
  const cells = splitCells(sectionText);
  console.log(`\n  Total cells after splitCells: ${cells.length}`);

  // Show first 50 cells with indices
  console.log('\n  First 60 cells:');
  cells.slice(0, 60).forEach((c, i) => {
    const typeResult = inferEntityType(c);
    console.log(`    [${i}] ${JSON.stringify(c)}${typeResult ? ` <-- TYPE: ${typeResult}` : ''}`);
  });

  // Find appointor/bene header
  const appointorIdx = cells.findIndex((c) => /^Appointor$/i.test(c));
  const beneHeaderIdx = cells.findIndex((c) => /shareholders\/beneficiaries/i.test(c));
  console.log(`\n  appointorIdx: ${appointorIdx}`);
  console.log(`  beneHeaderIdx: ${beneHeaderIdx}`);
  const dataStart = (appointorIdx >= 0 ? appointorIdx : beneHeaderIdx >= 0 ? beneHeaderIdx : -1) + 1;
  console.log(`  dataStart: ${dataStart}`);

  if (dataStart <= 0) {
    console.log('  ERROR: dataStart <= 0, parser returns [] immediately!');
    console.log('  Looking for "Appointor" or "Shareholders/Beneficiaries" header...');
    cells.forEach((c, i) => {
      if (/appointor/i.test(c) || /shareholder/i.test(c) || /beneficiar/i.test(c)) {
        console.log(`    [${i}] ${JSON.stringify(c)}`);
      }
    });
    return;
  }

  const dataCells = cells.slice(dataStart);
  console.log(`\n  dataCells count: ${dataCells.length}`);

  // Find all type keyword positions in dataCells
  const typePositions: { idx: number; type: string; cell: string }[] = [];
  for (let i = 0; i < dataCells.length; i++) {
    const t = inferEntityType(dataCells[i]);
    if (t) typePositions.push({ idx: i, type: t, cell: dataCells[i] });
  }
  console.log(`\n  Entity type positions in dataCells:`);
  typePositions.forEach((tp) => {
    console.log(`    dataCells[${tp.idx}] = ${JSON.stringify(tp.cell)} (type: ${tp.type})`);
    const nameIdx = tp.idx - 1;
    if (nameIdx >= 0) {
      console.log(`      --> name candidate: dataCells[${nameIdx}] = ${JSON.stringify(dataCells[nameIdx])}`);
    } else {
      console.log(`      --> nameIdx ${nameIdx} is out of range (no name found)`);
    }
  });

  // Parse result
  const items = parseEntityStructure(sectionText);
  console.log(`\n  parseEntityStructure result (${items.length} entities):`);
  items.forEach((item, i) => {
    console.log(`    [${i}] name="${item.name}" type="${item.type}" directors="${item.directors}" bene="${item.beneficiaries}" appt="${item.appointor}"`);
  });
}

async function processTestFile(testInfo: typeof TEST_FILES[0]): Promise<void> {
  const filePath = path.join(CLIENT_FILES, `Client Fact Find Report - Mind Map TEST (${testInfo.num}).docx`);
  console.log('\n' + '═'.repeat(80));
  console.log(`${testInfo.label}: ${filePath}`);
  console.log('═'.repeat(80));

  let rawText: string;
  try {
    rawText = await extractText(filePath);
  } catch (err) {
    console.error(`  ERROR reading file: ${err}`);
    return;
  }

  console.log(`\nRaw text length: ${rawText.length} chars`);

  // 1. Search for missing entity names in full raw text
  console.log('\n--- FULL TEXT SEARCH for missing entities ---');
  searchTextForMissing(rawText, testInfo.missing);

  // 2. Split sections
  const sections = splitSections(rawText);

  // 3. Search for missing entities in each section
  console.log('\n--- SECTION-BY-SECTION search ---');
  const sectionKeys = Object.keys(sections) as (keyof typeof sections)[];
  for (const key of sectionKeys) {
    const val = sections[key];
    if (val && typeof val === 'string') {
      for (const name of testInfo.missing) {
        const partial = name.slice(0, 15);
        if (val.includes(partial) || val.includes(name)) {
          console.log(`  Found clue for "${name.slice(0, 30)}..." in section: ${key}`);
          const idx = val.indexOf(partial);
          if (idx >= 0) {
            const snippet = val.slice(Math.max(0, idx - 50), idx + partial.length + 100);
            console.log(`    context: ${snippet.replace(/\n/g, '↵')}`);
          }
        }
      }
    }
  }

  // 4. Detailed entity structure analysis
  console.log('\n--- ENTITY STRUCTURE SECTION ANALYSIS ---');
  analyzeEntityStructureSection(sections.entityStructure);

  // 5. Also show entityHoldings section snippet (first 2000 chars)
  if (sections.entityHoldings) {
    console.log('\n--- ENTITY HOLDINGS SECTION (first 2000 chars) ---');
    console.log(sections.entityHoldings.slice(0, 2000).replace(/\n/g, '\n  '));
  } else {
    console.log('\n--- ENTITY HOLDINGS SECTION: null ---');
  }

  // 6. Check superannuation section for missing entities (TEST 24 specific)
  if (testInfo.num === 24) {
    console.log('\n--- SUPERANNUATION SECTION (first 2000 chars) ---');
    if (sections.superannuation) {
      console.log(sections.superannuation.slice(0, 2000).replace(/\n/g, '\n  '));
    } else {
      console.log('null');
    }
    console.log('\n--- PENSION SECTION (first 2000 chars) ---');
    if (sections.pension) {
      console.log(sections.pension.slice(0, 2000).replace(/\n/g, '\n  '));
    } else {
      console.log('null');
    }
  }
}

async function main(): Promise<void> {
  console.log('Debug: Missing entities in local parser\n');
  console.log(`Client files directory: ${CLIENT_FILES}\n`);

  for (const testInfo of TEST_FILES) {
    await processTestFile(testInfo);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
