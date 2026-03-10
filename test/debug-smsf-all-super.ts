import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { splitSections } from '../server/src/services/local/splitSections.js';
import { splitCells } from '../server/src/services/local/parseTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(__dirname, '..', 'client_files');
const goldData: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'batch-data.json'), 'utf8'));

// Check ALL super descriptions across ALL files to understand naming patterns
async function run() {
  const allDescriptions: { n: number; desc: string; owner: string; amount: number; hasSmsf: boolean; goldKeeps: boolean }[] = [];
  
  for (const g of goldData) {
    const n = parseInt(g.file.match(/TEST \((\d+)\)/)?.[1] || '0');
    if (!n) continue;
    
    const fname = `Client Fact Find Report - Mind Map TEST (${n}).docx`;
    const fpath = path.join(clientDir, fname);
    if (!fs.existsSync(fpath)) continue;
    
    const buf = fs.readFileSync(fpath);
    const { value: text } = await mammoth.extractRawText({ buffer: buf });
    const sections = splitSections(text);
    
    // Check if has SMSF entity
    const { assemble } = await import('../server/src/services/local/assembler.js');
    const plan = assemble(sections);
    const hasSmsf = plan.entities.some((e: any) => e.type === 'smsf');
    if (!hasSmsf) continue;
    
    // Get super entries from raw cells
    for (const secName of ['superannuation', 'pension'] as const) {
      const sec = sections[secName];
      if (!sec) continue;
      const cells = splitCells(sec);
      const headerIdx = cells.findIndex(c => /^Description$/i.test(c));
      if (headerIdx < 0) continue;
      const dataCells = cells.slice(headerIdx + 4);
      
      let i = 0;
      while (i < dataCells.length) {
        if (/^total$/i.test(dataCells[i])) break;
        let amtIdx = -1;
        for (let j = i + 1; j < dataCells.length; j++) {
          if (/^-?\$/.test(dataCells[j])) { amtIdx = j; break; }
        }
        if (amtIdx < 0) break;
        
        const desc = dataCells[i];
        const owner = i + 1 < amtIdx ? dataCells[i + 1] : '';
        const amount = parseInt(dataCells[amtIdx].replace(/[$,()]/g, '')) || 0;
        
        // Check if gold keeps this entry
        const goldSuper = (g.data?.personalAssets || []).filter((a: any) => a.type === 'super' || a.type === 'pension');
        const goldKeeps = goldSuper.some((a: any) => Math.abs((a.value || 0) - amount) < 10);
        
        allDescriptions.push({ n, desc, owner, amount, hasSmsf, goldKeeps });
        i = amtIdx + 1;
      }
    }
  }
  
  // Print all with SMSF, showing whether gold keeps them
  console.log("All super/pension entries in SMSF files:");
  for (const d of allDescriptions) {
    const status = d.goldKeeps ? 'KEPT' : 'DROPPED';
    console.log(`  TEST (${d.n}) ${status}: "${d.desc}" (${d.owner}) $${d.amount.toLocaleString()}`);
  }
}
run().catch(console.error);
