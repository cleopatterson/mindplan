import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { splitSections } from '../server/src/services/local/splitSections.js';

const dir = 'client_files/Avril clients';

async function main() {
  for (let num = 73; num <= 82; num++) {
    const file = readFileSync(`${dir}/Client Fact Find Report - Mind Map TEST (${num}).docx`);
    const { value: text } = await mammoth.extractRawText({ buffer: file });
    const sections = splitSections(text);

    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# TEST ${num}`);
    console.log('#'.repeat(70));

    // Show key financial sections raw text
    const show = (name: string, val: string | null) => {
      if (!val) { console.log(`--- ${name}: (empty) ---`); return; }
      console.log(`--- ${name} ---`);
      console.log(val.substring(0, 2000));
    };

    show('Personal Details', sections.personalDetails);
    show('Income', sections.income);
    show('Lifestyle Assets', sections.lifestyleAssets);
    show('Bank Accounts', sections.bankAccounts);
    show('Financial Investments', sections.financialInvestments);
    show('Superannuation', sections.superannuation);
    show('Pension', sections.pension);
    show('Shares', sections.shares);
    show('Investment Property', sections.investmentProperty);
    show('Loans', sections.loans);
    show('Entity Structure', sections.entityStructure);
    show('Entity Holdings', sections.entityHoldings);
    show('Insurance', sections.insurance);
  }
}
main();
