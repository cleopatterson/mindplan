import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

for (const n of [1, 3, 16, 21, 55]) {
  const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
  if (!gd) continue;
  
  const smsfEntities = (gd.entities || []).filter((e: any) => e.type === 'smsf');
  console.log(`\n=== TEST (${n}) gold SMSF entities ===`);
  for (const e of smsfEntities) {
    const total = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
    console.log(`  ${e.name} (${e.assets.length} assets, $${total.toLocaleString()}):`);
    for (const a of e.assets) {
      console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
    }
  }
  
  const goldSuper = (gd.personalAssets || []).filter((a: any) => a.type === 'super' || a.type === 'pension');
  console.log(`  Gold super personal assets: ${goldSuper.length}`);
  for (const a of goldSuper) console.log(`    ${a.type} | ${a.name} | $${(a.value||0).toLocaleString()}`);
}
