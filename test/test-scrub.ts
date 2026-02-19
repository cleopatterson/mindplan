import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrubSensitiveData } from '../server/src/services/scrub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || 'sample-factfind.txt';
const text = fs.readFileSync(path.join(__dirname, file), 'utf-8');

console.log(`\n=== Testing scrubber on: ${file} (${text.length} chars) ===\n`);

const { text: scrubbed, surnames } = scrubSensitiveData(text);

console.log(`\nDetected surnames: [${surnames.join(', ')}]`);
console.log(`\n--- Scrubbed output (first 3000 chars) ---\n`);
console.log(scrubbed.slice(0, 3000));

// Check for any remaining sensitive data
console.log(`\n--- Remaining sensitivity check ---`);
for (const sn of surnames) {
  const remaining = scrubbed.split(sn).length - 1;
  if (remaining > 0) console.log(`  WARNING: "${sn}" still appears ${remaining} times!`);
}

// Check DOBs
const dobPattern = /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi;
const remainingDobs = scrubbed.match(dobPattern) || [];
if (remainingDobs.length > 0) {
  console.log(`  WARNING: ${remainingDobs.length} raw DOBs remain: ${remainingDobs.join(', ')}`);
} else {
  console.log(`  OK: No raw DOBs found`);
}

// Check ABNs
const abnPattern = /\bABN[:\s]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/gi;
const remainingAbns = scrubbed.match(abnPattern) || [];
if (remainingAbns.length > 0) {
  console.log(`  WARNING: ${remainingAbns.length} raw ABNs remain: ${remainingAbns.join(', ')}`);
} else {
  console.log(`  OK: No raw ABNs found`);
}

console.log(`\nDone.`);
