import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { parseWithLocal } from '../server/src/services/local/index.js';

const dir = 'client_files/Avril clients';

async function main() {
  for (let num = 73; num <= 82; num++) {
    const file = readFileSync(`${dir}/Client Fact Find Report - Mind Map TEST (${num}).docx`);
    const { value: text } = await mammoth.extractRawText({ buffer: file });
    const plan = await parseWithLocal(text);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST ${num} — ${plan.clients.map(c => c.name).join(' & ')}`);
    console.log('='.repeat(70));

    // Clients
    console.log('--- Clients ---');
    plan.clients.forEach(c => {
      console.log(`  ${c.name} | age=${c.age} | occ="${c.occupation}" | income=$${c.income?.toLocaleString() ?? 'null'}`);
    });

    // Personal Assets
    console.log(`--- Personal Assets (${plan.personalAssets.length}) ---`);
    plan.personalAssets.forEach(a => {
      const v = a.value ?? 0;
      console.log(`  [${a.type}] "${a.name}" | owner="${a.owner}" | $${v.toLocaleString()}${a.value === null ? ' (null)' : ''}`);
    });
    const totalPA = plan.personalAssets.filter(a => a.type !== 'insurance').reduce((s, a) => s + (a.value ?? 0), 0);
    console.log(`  TOTAL (ex insurance): $${totalPA.toLocaleString()}`);

    // Entities
    if (plan.entities.length > 0) {
      console.log(`--- Entities (${plan.entities.length}) ---`);
      plan.entities.forEach(e => {
        const eat = e.assets.reduce((s, a) => s + (a.value ?? 0), 0);
        const elt = e.liabilities.reduce((s, l) => s + (l.amount ?? 0), 0);
        console.log(`  "${e.name}" (${e.type}) | assets=$${eat.toLocaleString()} (${e.assets.length}) | liab=$${elt.toLocaleString()} (${e.liabilities.length})`);
        e.assets.forEach(a => console.log(`    [${a.type}] "${a.name}" $${(a.value ?? 0).toLocaleString()}`));
        e.liabilities.forEach(l => console.log(`    [LIAB] "${l.name}" $${(l.amount ?? 0).toLocaleString()}`));
      });
    }

    // Personal Liabilities
    const liabs = plan.personalLiabilities || [];
    if (liabs.length > 0) {
      console.log(`--- Liabilities (${liabs.length}) ---`);
      liabs.forEach(l => {
        console.log(`  "${l.name}" | owner="${l.owner}" | $${(l.amount ?? 0).toLocaleString()}`);
      });
      const totalLiab = liabs.reduce((s, l) => s + (l.amount ?? 0), 0);
      console.log(`  TOTAL: $${totalLiab.toLocaleString()}`);
    }

    // Insurance count
    const ins = plan.personalAssets.filter(a => a.type === 'insurance');
    if (ins.length > 0) {
      console.log(`--- Insurance (${ins.length}) ---`);
      ins.forEach(i => console.log(`  "${i.name}" | owner="${i.owner}" | cover=$${(i.value ?? 0).toLocaleString()}`));
    }

    // Summary
    const entityAssets = plan.entities.reduce((s, e) => s + e.assets.reduce((s2, a) => s2 + (a.value ?? 0), 0), 0);
    const totalLiab = liabs.reduce((s, l) => s + (l.amount ?? 0), 0);
    const entityLiab = plan.entities.reduce((s, e) => s + e.liabilities.reduce((s2, l) => s2 + (l.amount ?? 0), 0), 0);
    console.log(`--- SUMMARY ---`);
    console.log(`  Personal assets (ex ins): $${totalPA.toLocaleString()}`);
    console.log(`  Entity assets: $${entityAssets.toLocaleString()}`);
    console.log(`  Personal liabilities: $${totalLiab.toLocaleString()}`);
    console.log(`  Entity liabilities: $${entityLiab.toLocaleString()}`);
    console.log(`  Net worth: $${(totalPA + entityAssets - totalLiab - entityLiab).toLocaleString()}`);
  }
}
main();
