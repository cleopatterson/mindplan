import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { assemble } from '../server/src/services/local/assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

async function run() {
  // Check SMSF entity assets for files with diffs AND matches
  for (const n of [55, 3, 21, 1, 16, 2, 9, 10, 15, 29]) {
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;
    
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    const plan = assemble(sections);
    const gd = goldData.find((g: any) => g.file.includes(`TEST (${n})`))?.data;
    
    const smsfEntities = plan.entities.filter((e: any) => e.type === 'smsf');
    if (smsfEntities.length === 0) continue;
    
    const localSuper = plan.personalAssets.filter((a: any) => a.type === 'super' || a.type === 'pension');
    const goldSuper = (gd?.personalAssets || []).filter((a: any) => a.type === 'super' || a.type === 'pension');
    const isDiff = localSuper.length !== goldSuper.length;
    
    console.log(`\n=== TEST (${n}) ${isDiff ? 'DIFF' : 'MATCH'} ===`);
    for (const e of smsfEntities) {
      console.log(`  SMSF: "${e.name}" assets:`);
      for (const a of e.assets) {
        console.log(`    ${a.type} | "${a.name}" | $${(a.value||0).toLocaleString()}`);
      }
    }
  }
}
run().catch(console.error);
