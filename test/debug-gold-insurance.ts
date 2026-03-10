import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

// For each file, check insurance assets and their values
let filesWithInsurance = 0;
let filesWithZeroInsurance = 0;
let filesWithNonZeroInsurance = 0;
let filesWithMixed = 0;

for (const g of goldData) {
  const n = g.file.match(/TEST \((\d+)\)/)?.[1];
  const insuranceAssets = (g.data?.personalAssets || []).filter((a: any) => a.type === 'insurance');
  if (insuranceAssets.length === 0) continue;
  
  filesWithInsurance++;
  const allZero = insuranceAssets.every((a: any) => (a.value || 0) === 0);
  const allNonZero = insuranceAssets.every((a: any) => (a.value || 0) !== 0);
  
  if (allZero) {
    filesWithZeroInsurance++;
    console.log(`TEST (${n}): ALL ZERO (${insuranceAssets.length} items)`);
  } else if (allNonZero) {
    filesWithNonZeroInsurance++;
    console.log(`TEST (${n}): ALL NON-ZERO (${insuranceAssets.length} items, total $${insuranceAssets.reduce((s: number, a: any) => s + (a.value || 0), 0).toLocaleString()})`);
  } else {
    filesWithMixed++;
    console.log(`TEST (${n}): MIXED`);
    for (const a of insuranceAssets) {
      console.log(`  ${a.name} = $${(a.value||0).toLocaleString()}`);
    }
  }
}

console.log(`\nSummary:`);
console.log(`Files with insurance: ${filesWithInsurance}`);
console.log(`All zero: ${filesWithZeroInsurance}`);
console.log(`All non-zero: ${filesWithNonZeroInsurance}`);
console.log(`Mixed: ${filesWithMixed}`);
