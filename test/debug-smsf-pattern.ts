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
  // Find all files where local has SMSF entity AND extra super entries vs gold
  for (const g of goldData) {
    const n = g.file.match(/TEST \((\d+)\)/)?.[1];
    if (!n) continue;
    
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;
    
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    const plan = assemble(sections);
    const gd = g.data;
    
    // Check for SMSF entities
    const smsfEntities = plan.entities.filter((e: any) => e.type === 'smsf');
    if (smsfEntities.length === 0) continue;
    
    const localSuper = plan.personalAssets.filter((a: any) => a.type === 'super' || a.type === 'pension');
    const goldSuper = (gd?.personalAssets || []).filter((a: any) => a.type === 'super' || a.type === 'pension');
    
    const localSuperTotal = localSuper.reduce((s: number, a: any) => s + (a.value || 0), 0);
    const goldSuperTotal = goldSuper.reduce((s: number, a: any) => s + (a.value || 0), 0);
    
    console.log(`\nTEST (${n}): ${smsfEntities.length} SMSF(s), local super ${localSuper.length}/$${localSuperTotal.toLocaleString()}, gold super ${goldSuper.length}/$${goldSuperTotal.toLocaleString()}`);
    for (const e of smsfEntities) {
      const eTotal = e.assets.reduce((s: number, a: any) => s + (a.value || 0), 0);
      console.log(`  SMSF: "${e.name}" (${e.assets.length} assets, $${eTotal.toLocaleString()})`);
    }
    if (localSuper.length !== goldSuper.length || localSuperTotal !== goldSuperTotal) {
      console.log(`  DIFF! Local super entries:`);
      for (const a of localSuper) console.log(`    ${a.name} = $${(a.value||0).toLocaleString()}`);
      console.log(`  Gold super entries:`);
      for (const a of goldSuper) console.log(`    ${a.name} = $${(a.value||0).toLocaleString()}`);
    } else {
      console.log(`  MATCH (no diff)`);
    }
  }
}
run().catch(console.error);
