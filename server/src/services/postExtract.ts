/**
 * Code-based post-extraction: scan document text for structured data
 * that the LLM may have missed (advisers, estate planning, goals).
 *
 * Runs AFTER LLM parsing + coerce. Merges found data into the plan
 * without overwriting what the LLM already extracted.
 */

import type { FinancialPlan } from 'shared/types';

// ── Client validation ──
// Detect "Prepared for" / "Client:" lines and demote non-clients to family members.

const PREPARED_FOR_PATTERNS = [
  // Table format: "| Prepared for | Name Surname |"
  /\|\s*Prepared\s+for\s*\|\s*(.+?)\s*\|/i,
  // "Prepared for\nName Surname" or "Prepared for: Name Surname"
  /prepared\s+for\s*[:\n]\s*(.+?)(?:\n|$)/i,
  // "Client: Name Surname" or table "| Client | Name |"
  /\|\s*Client\s*\|\s*(.+?)\s*\|/i,
  /^client\s*:\s*(.+?)(?:\n|$)/im,
  // "For: Name & Name Surname"
  /^for\s*:\s*(.+?)(?:\n|$)/im,
  // "FINANCIAL PLAN — Name & Name Surname"
  /financial\s+plan\s*[—–-]\s*(.+?)(?:\n|$)/i,
];

/** Extract the intended client names from the document header */
function detectClientNames(text: string): string[] {
  // Only look at first 2000 chars (header area)
  const header = text.slice(0, 2000);

  for (const re of PREPARED_FOR_PATTERNS) {
    const match = header.match(re);
    if (!match) continue;

    const raw = match[1].trim();
    // Split on " & " or " and " for couples: "James & Mary Wall"
    const parts = raw.split(/\s+(?:&|and)\s+/i);
    if (parts.length === 1) return [raw];

    // For "James & Mary Wall" — the last part has the surname
    const last = parts[parts.length - 1].trim();
    const surname = last.split(/\s+/).pop() || '';
    return parts.map((p, i) => {
      const trimmed = p.trim();
      // If this part doesn't already contain a space (no surname), append the shared surname
      if (i < parts.length - 1 && !trimmed.includes(' ') && surname) {
        return `${trimmed} ${surname}`;
      }
      return trimmed;
    });
  }
  return [];
}

/** Normalize name for comparison: lowercase, collapse whitespace */
function normName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function validateClients(text: string, plan: FinancialPlan): void {
  const docClientNames = detectClientNames(text);
  if (docClientNames.length === 0) return; // couldn't detect, leave as-is
  if (plan.clients.length <= docClientNames.length) return; // count already correct

  const docNorms = new Set(docClientNames.map(normName));

  // Separate real clients from wrongly-classified ones
  const realClients: typeof plan.clients = [];
  const demoted: typeof plan.clients = [];

  for (const client of plan.clients) {
    // Check if this client's name matches any "Prepared for" name
    const clientNorm = normName(client.name);
    const isReal = docNorms.has(clientNorm) ||
      // Also match on first name if doc has "Dorothy" and client is "Dorothy June Smith"
      docClientNames.some(dn => {
        const dnFirst = normName(dn.split(' ')[0]);
        const cFirst = normName(client.name.split(' ')[0]);
        return dnFirst === cFirst;
      });

    if (isReal) {
      realClients.push(client);
    } else {
      demoted.push(client);
    }
  }

  if (demoted.length === 0) return;

  console.log(`⏱ [postExtract] Client validation: "${docClientNames.join(', ')}" detected as client(s)`);
  console.log(`⏱ [postExtract] Demoting ${demoted.length} non-clients to family members: ${demoted.map(c => c.name).join(', ')}`);

  // Replace clients array with real clients only
  plan.clients.length = 0;
  plan.clients.push(...realClients);

  // Add demoted clients as family members (if not already present)
  const existingFamilyNames = new Set(plan.familyMembers.map(fm => normName(fm.name)));
  let nextFmId = plan.familyMembers.length + 1;

  for (const d of demoted) {
    if (existingFamilyNames.has(normName(d.name))) continue;
    plan.familyMembers.push({
      id: `family-${nextFmId++}`,
      name: d.name,
      relationship: 'other',
      partner: null,
      age: d.age,
      isDependant: false,
      details: d.occupation ? `${d.occupation}${d.income ? `, income $${d.income}` : ''}` : null,
      children: [],
    });
  }

  // Clean up ownerIds referencing demoted client IDs
  const demotedIds = new Set(demoted.map(d => d.id));
  const realClientIds = new Set(realClients.map(c => c.id));

  for (const asset of plan.personalAssets) {
    asset.ownerIds = asset.ownerIds.filter(id => !demotedIds.has(id));
    if (asset.ownerIds.length === 0 && realClients.length > 0) {
      asset.ownerIds = realClients.map(c => c.id);
    }
  }
  for (const liability of plan.personalLiabilities) {
    liability.ownerIds = liability.ownerIds.filter(id => !demotedIds.has(id));
    if (liability.ownerIds.length === 0 && realClients.length > 0) {
      liability.ownerIds = realClients.map(c => c.id);
    }
  }

  // Clean up entity linkedClientIds
  for (const entity of plan.entities) {
    entity.linkedClientIds = entity.linkedClientIds.filter(id => !demotedIds.has(id));
    if (entity.linkedClientIds.length === 0 && realClients.length > 0) {
      entity.linkedClientIds = realClients.map(c => c.id);
    }
  }
}

// ── Adviser extraction ──

const ADVISER_SECTION_RE = /(?:other\s+)?(?:professional\s+)?(?:adviser|advisor|contact|referral)s?\b[\s\S]*?(?=\n={3,}|\n─{3,}|\n\s*\n\s*\n|$)/i;

type AdviserType = FinancialPlan['relationships'][0]['type'];

const ADVISER_PATTERNS: { re: RegExp; type: AdviserType }[] = [
  { re: /accountant\s*[:\-–—]\s*(.+)/i, type: 'accountant' },
  { re: /solicitor\s*[:\-–—]\s*(.+)/i, type: 'solicitor' },
  { re: /lawyer\s*[:\-–—]\s*(.+)/i, type: 'solicitor' },
  { re: /stockbroker\s*[:\-–—]\s*(.+)/i, type: 'stockbroker' },
  { re: /insurance\s+(?:adviser|advisor|broker)\s*[:\-–—]\s*(.+)/i, type: 'insurance_adviser' },
  { re: /mortgage\s+broker\s*[:\-–—]\s*(.+)/i, type: 'mortgage_broker' },
  { re: /financial\s+(?:adviser|advisor|planner)\s*[:\-–—]\s*(.+)/i, type: 'financial_adviser' },
];

/** Parse "Name at Firm" or "Name, Firm" or "Name — Firm" or just "Name" */
function parseAdviserLine(line: string): { contactName: string | null; firmName: string | null } {
  line = line.trim().replace(/\.$/, '');
  if (/^none|^n\/a|^not\s/i.test(line)) return { contactName: null, firmName: null };

  // "Name at Firm" or "Name — Firm" or "Name, Firm"
  const split = line.split(/\s+(?:at|of|from|–|—|,)\s+/i);
  if (split.length >= 2) {
    return { contactName: split[0].trim(), firmName: split.slice(1).join(', ').trim() };
  }
  // Just a name or firm
  return { contactName: line, firmName: null };
}

function extractAdvisers(text: string, plan: FinancialPlan): void {
  if (plan.relationships.length > 0) return; // LLM already extracted advisers

  const existingTypes = new Set(plan.relationships.map((r) => r.type));
  let nextId = plan.relationships.length + 1;
  const clientIds = plan.clients.map((c) => c.id);

  // Also check the document header for "Adviser: Name, Firm"
  const headerAdviser = text.match(/^(?:adviser|advisor|planner)\s*[:\-–—]\s*(.+?)(?:\n|$)/im);
  if (headerAdviser && !existingTypes.has('financial_adviser')) {
    const { contactName, firmName } = parseAdviserLine(headerAdviser[1]);
    if (contactName) {
      plan.relationships.push({
        id: `rel-${nextId++}`,
        clientIds,
        type: 'financial_adviser',
        contactName,
        firmName,
        notes: null,
      });
      existingTypes.add('financial_adviser');
    }
  }

  // Scan for adviser section or individual lines
  for (const { re, type } of ADVISER_PATTERNS) {
    if (existingTypes.has(type)) continue;
    const match = text.match(re);
    if (!match) continue;
    const { contactName, firmName } = parseAdviserLine(match[1]);
    if (!contactName) continue;
    plan.relationships.push({
      id: `rel-${nextId++}`,
      clientIds,
      type: type as FinancialPlan['relationships'][0]['type'],
      contactName,
      firmName,
      notes: null,
    });
    existingTypes.add(type);
  }

  if (plan.relationships.length > 0) {
    console.log(`⏱ [postExtract] Extracted ${plan.relationships.length} advisers from document text`);
  }
}

// ── Estate planning extraction ──

const ESTATE_KEYWORDS: { re: RegExp; type: 'will' | 'poa' | 'guardianship' | 'super_nomination' }[] = [
  { re: /\bwill\b/i, type: 'will' },
  { re: /\b(?:power\s+of\s+attorney|poa|epa|enduring\s+power)\b/i, type: 'poa' },
  { re: /\b(?:guardianship|epg|enduring\s+guardian)\b/i, type: 'guardianship' },
  { re: /\b(?:death\s+benefit\s+nomination|binding\s+nomination|non-binding\s+nomination|bdbn|super\s+nomination)\b/i, type: 'super_nomination' },
];

const STATUS_PATTERNS: { re: RegExp; status: 'current' | 'expired' | 'not_established' }[] = [
  { re: /\b(?:current|in\s+place|up\s+to\s+date|established|yes)\b/i, status: 'current' },
  { re: /\b(?:expired|lapsed|out\s+of\s+date|outdated)\b/i, status: 'expired' },
  { re: /\b(?:not?\s+established|none|no\s+will|no\s+poa|not?\s+in\s+place|n\/a)\b/i, status: 'not_established' },
];

function extractEstatePlanning(text: string, plan: FinancialPlan): void {
  if (plan.estatePlanning.length > 0) return; // LLM already got them

  // Look for estate planning section
  const estateSection = text.match(
    /(?:estate\s+planning|estate\s+plan|wills?\s+(?:&|and)\s+(?:estate|poa)|testamentary)[\s\S]*?(?=\n={3,}|\n─{3,}|\n\s*(?:[A-Z]{2,}[\s\S]{0,30}\n={3,})|\n\s*\n\s*\n\s*\n|$)/i,
  );
  if (!estateSection) return;

  const section = estateSection[0];
  const clientIds = plan.clients.map((c) => c.id);
  let nextId = 1;

  // For each client, try to find estate items
  for (const clientId of clientIds) {
    for (const { re, type } of ESTATE_KEYWORDS) {
      if (!re.test(section)) continue;

      // Check if already exists for this client
      const exists = plan.estatePlanning.some((ep) => ep.clientId === clientId && ep.type === type);
      if (exists) continue;

      // Try to determine status from nearby text
      let status: 'current' | 'expired' | 'not_established' | null = null;
      // Look at lines containing this keyword
      const lines = section.split('\n');
      for (const line of lines) {
        if (!re.test(line)) continue;
        for (const sp of STATUS_PATTERNS) {
          if (sp.re.test(line)) {
            status = sp.status;
            break;
          }
        }
        if (status) break;
      }

      plan.estatePlanning.push({
        id: `estate-${nextId++}`,
        clientId,
        type,
        status,
        lastReviewed: null,
        primaryPerson: null,
        alternatePeople: null,
        details: null,
        hasIssue: status === 'expired' || status === 'not_established',
      });
    }
  }

  if (plan.estatePlanning.length > 0) {
    console.log(`⏱ [postExtract] Extracted ${plan.estatePlanning.length} estate planning items from document text`);
  }
}

// ── Goals extraction ──

const GOAL_PATTERNS: { re: RegExp; category: string; name: string }[] = [
  { re: /\bretir(?:e|ement|ing)\b.*?(?:at\s+)?(\d{2})/i, category: 'retirement', name: 'Retire at {1}' },
  { re: /\bretir(?:e|ement|ing)\b/i, category: 'retirement', name: 'Retirement planning' },
  { re: /\beducation\b.*?\bchild/i, category: 'education', name: 'Fund children\'s education' },
  { re: /\bschool\s+fees?\b/i, category: 'education', name: 'Fund school fees' },
  { re: /\bpay\s+(?:off|down)\s+(?:the\s+)?mortgage/i, category: 'wealth', name: 'Pay off mortgage' },
  { re: /\bdebt\s+(?:free|reduction|repayment)\b/i, category: 'wealth', name: 'Debt reduction' },
  { re: /\binvestment\s+property\b/i, category: 'wealth', name: 'Purchase investment property' },
  { re: /\bwealth\s+(?:building|creation|accumulation)\b/i, category: 'wealth', name: 'Wealth building' },
  { re: /\binsurance\s+review\b/i, category: 'protection', name: 'Review insurance coverage' },
  { re: /\bestate\s+plan/i, category: 'estate', name: 'Estate planning' },
  { re: /\bdownsiz(?:e|ing)\b/i, category: 'lifestyle', name: 'Downsize home' },
  { re: /\btravel\b/i, category: 'lifestyle', name: 'Travel' },
  { re: /\brenovati(?:on|ng|e)\b/i, category: 'lifestyle', name: 'Home renovation' },
];

function extractGoals(text: string, plan: FinancialPlan): void {
  if (plan.goals.length > 0) return; // LLM already got them

  // Look for objectives/goals section
  const goalSection = text.match(
    /(?:objectives?|goals?|priorities|aims|what.*?(?:want|achieve|looking\s+for))[\s\S]*?(?=\n={3,}|\n─{3,}|\n\s*(?:[A-Z]{2,}[\s\S]{0,30}\n={3,})|\n\s*\n\s*\n\s*\n|$)/i,
  );

  const searchText = goalSection ? goalSection[0] : text;
  const existingNames = new Set(plan.goals.map((g) => g.name.toLowerCase()));
  let nextId = plan.goals.length + 1;

  for (const { re, category, name: nameTemplate } of GOAL_PATTERNS) {
    const match = searchText.match(re);
    if (!match) continue;

    // Replace {1} with capture group
    const name = nameTemplate.replace('{1}', match[1] || '');
    if (existingNames.has(name.toLowerCase())) continue;

    plan.goals.push({
      id: `goal-${nextId++}`,
      name,
      category: category as FinancialPlan['goals'][0]['category'],
      detail: null,
      timeframe: null,
      value: null,
    });
    existingNames.add(name.toLowerCase());
  }

  if (plan.goals.length > 0) {
    console.log(`⏱ [postExtract] Extracted ${plan.goals.length} goals from document text`);
  }
}

// ── Main entry point ──

export function postExtract(documentText: string, plan: FinancialPlan): void {
  const t0 = performance.now();
  validateClients(documentText, plan);
  extractAdvisers(documentText, plan);
  extractEstatePlanning(documentText, plan);
  extractGoals(documentText, plan);
  const elapsed = performance.now() - t0;
  if (elapsed > 1) {
    console.log(`⏱ [postExtract] Total: ${elapsed.toFixed(0)}ms`);
  }
}
