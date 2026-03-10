/**
 * Debug script: investigate duplicate super/pension entries for TEST (1), (3), and (55).
 *
 * Theory: splitSections.ts may be extracting overlapping text for the
 * Superannuation and Pension sections, causing the same dollar figures to
 * appear in both sections and therefore be parsed twice.
 *
 * Usage: npx tsx test/debug-super-sections.ts
 */

import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { parseSuperannuation, parsePension } from '../server/src/services/local/sections/superPension.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');

const TARGETS = [1, 3, 55];
const PREVIEW_CHARS = 2000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Return the line numbers (1-based) where a pattern first matches */
function findMatchingLines(text: string, pattern: RegExp): number[] {
  const lines = text.split('\n');
  const result: number[] = [];
  lines.forEach((line, idx) => {
    if (pattern.test(line.trim())) result.push(idx + 1);
  });
  return result;
}

/** Check whether two text blobs share any dollar values */
function findDollarOverlap(superText: string | null, pensionText: string | null): string[] {
  if (!superText || !pensionText) return [];
  const dollarRe = /\$[\d,]+/g;
  const superDollars = new Set(superText.match(dollarRe) ?? []);
  const pensionDollars = pensionText.match(dollarRe) ?? [];
  return pensionDollars.filter((d) => superDollars.has(d));
}

/** Find shared non-trivial words between two sections */
function findLineOverlap(superText: string | null, pensionText: string | null): string[] {
  if (!superText || !pensionText) return [];
  const superLines = new Set(
    superText.split('\n').map((l) => l.trim()).filter((l) => l.length > 5),
  );
  return pensionText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && superLines.has(l));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function analyseFile(n: number) {
  const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
  const fpath = path.join(clientDir, fname);

  console.log('\n' + '═'.repeat(70));
  console.log(`TEST (${n}) — ${fname}`);
  console.log('═'.repeat(70));

  if (!fs.existsSync(fpath)) {
    console.log('  FILE NOT FOUND — skipping');
    return;
  }

  const buf = fs.readFileSync(fpath);
  const { value: rawText } = await mammoth.extractRawText({ buffer: buf });
  const sections = splitSections(rawText);

  // ── 1. Raw section boundaries ──────────────────────────────────────────
  console.log('\n--- Section presence ---');
  console.log(`  superannuation section: ${sections.superannuation !== null ? `YES (${sections.superannuation.length} chars)` : 'NULL'}`);
  console.log(`  pension section:        ${sections.pension !== null ? `YES (${sections.pension.length} chars)` : 'NULL'}`);

  // Find all "Superannuation" and "Pension" keyword occurrences in raw text
  const superLines = findMatchingLines(rawText, /^Superannuation$/i);
  const pensionLines = findMatchingLines(rawText, /^Pension$/i);
  console.log(`\n  "Superannuation" lines in raw text: ${superLines.join(', ') || 'none'}`);
  console.log(`  "Pension" lines in raw text:        ${pensionLines.join(', ') || 'none'}`);

  // ── 2. Superannuation section preview ─────────────────────────────────
  console.log('\n--- SUPERANNUATION section (first 2000 chars) ---');
  if (sections.superannuation) {
    console.log(sections.superannuation.slice(0, PREVIEW_CHARS));
    if (sections.superannuation.length > PREVIEW_CHARS) {
      console.log(`... [${sections.superannuation.length - PREVIEW_CHARS} more chars truncated]`);
    }
  } else {
    console.log('  (null — section not found)');
  }

  // ── 3. Pension section preview ─────────────────────────────────────────
  console.log('\n--- PENSION section (first 2000 chars) ---');
  if (sections.pension) {
    console.log(sections.pension.slice(0, PREVIEW_CHARS));
    if (sections.pension.length > PREVIEW_CHARS) {
      console.log(`... [${sections.pension.length - PREVIEW_CHARS} more chars truncated]`);
    }
  } else {
    console.log('  (null — section not found)');
  }

  // ── 4. Overlap analysis ────────────────────────────────────────────────
  console.log('\n--- Overlap analysis ---');

  const dollarOverlap = findDollarOverlap(sections.superannuation, sections.pension);
  if (dollarOverlap.length > 0) {
    console.log(`  DOLLAR VALUES appearing in BOTH sections (${dollarOverlap.length}):`);
    for (const d of dollarOverlap) console.log(`    ${d}`);
  } else {
    console.log('  No dollar-value overlap between sections.');
  }

  const lineOverlap = findLineOverlap(sections.superannuation, sections.pension);
  if (lineOverlap.length > 0) {
    console.log(`\n  LINES appearing in BOTH sections (${lineOverlap.length}):`);
    for (const l of lineOverlap.slice(0, 20)) console.log(`    "${l}"`);
  } else {
    console.log('  No line-level overlap between sections.');
  }

  // ── 5. Parsed items ────────────────────────────────────────────────────
  console.log('\n--- Parsed superannuation items ---');
  const superItems = parseSuperannuation(sections.superannuation);
  if (superItems.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of superItems) {
      const amt = item.amount !== null ? `$${item.amount.toLocaleString()}` : 'null';
      console.log(`  [super]   "${item.description}" | owner="${item.owner}" | ${amt}`);
    }
  }

  console.log('\n--- Parsed pension items ---');
  const pensionItems = parsePension(sections.pension);
  if (pensionItems.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of pensionItems) {
      const amt = item.amount !== null ? `$${item.amount.toLocaleString()}` : 'null';
      console.log(`  [pension] "${item.description}" | owner="${item.owner}" | ${amt}`);
    }
  }

  // ── 6. Detect if pension text starts inside superannuation text ────────
  console.log('\n--- Containment check ---');
  if (sections.superannuation && sections.pension) {
    // Find where pension section starts in the raw text, and check if super section ends after it
    const superStart = rawText.indexOf(sections.superannuation.slice(0, 50));
    const superEnd = superStart + sections.superannuation.length;
    const pensionStart = rawText.indexOf(sections.pension.slice(0, 50));
    const pensionEnd = pensionStart + sections.pension.length;

    console.log(`  Super section raw position:  chars ${superStart}–${superEnd}`);
    console.log(`  Pension section raw position: chars ${pensionStart}–${pensionEnd}`);

    if (superEnd > pensionStart && superStart < pensionEnd) {
      console.log('  *** OVERLAP DETECTED: sections share raw text range! ***');
      const overlapStart = Math.max(superStart, pensionStart);
      const overlapEnd = Math.min(superEnd, pensionEnd);
      const overlapText = rawText.slice(overlapStart, overlapEnd);
      console.log(`  Overlapping text (first 500 chars):\n${overlapText.slice(0, 500)}`);
    } else {
      console.log('  No raw-text positional overlap (sections are distinct ranges).');
    }
  } else {
    console.log('  Cannot check — one or both sections are null.');
  }

  // ── 7. Raw text around "Superannuation" and "Pension" keywords ─────────
  console.log('\n--- Raw text context around each keyword occurrence ---');
  const allLines = rawText.split('\n');
  let occurrence = 0;
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    if (/^Superannuation$/i.test(trimmed) || /^Pension$/i.test(trimmed)) {
      occurrence++;
      const start = Math.max(0, i - 2);
      const end = Math.min(allLines.length, i + 8);
      const context = allLines.slice(start, end).map((l, j) =>
        `    ${start + j + 1}: ${l}`
      ).join('\n');
      console.log(`\n  Occurrence ${occurrence} — line ${i + 1} "${trimmed}":`);
      console.log(context);
    }
  }
}

async function main() {
  for (const n of TARGETS) {
    await analyseFile(n);
  }
  console.log('\n' + '═'.repeat(70));
  console.log('Done.');
}

main().catch(console.error);
