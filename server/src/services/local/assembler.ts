/**
 * Assembler: combines parsed sections into a complete FinancialPlan.
 * Handles ID generation, owner resolution, and cross-linking.
 */
import type {
  FinancialPlan, Client, Entity, Asset, Liability,
  EstatePlanItem, FamilyMember, Grandchild, Goal,
  Relationship, DataGap,
} from 'shared/types';
import type { Sections } from './splitSections.js';
import { parseHeader } from './sections/header.js';
import { parsePersonalDetails } from './sections/personalDetails.js';
import { parseIncome, type IncomeItem } from './sections/income.js';
import { parsePersonalAssets } from './sections/personalAssets.js';
import { parseSuperannuation, parsePension } from './sections/superPension.js';
import { parseInvestmentProperty } from './sections/investmentProperty.js';
import { parseEntityStructure } from './sections/entityStructure.js';
import { parseEntityHoldings } from './sections/entityHoldings.js';
import { parseInsurance } from './sections/insurance.js';
import { parseLoans } from './sections/loans.js';
import { parseGoals } from './sections/goals.js';
import { parseRelationships, inferRelationshipType } from './sections/relationships.js';
import { parseDependants, parseAdultChildren, ageFromDob } from './sections/dependants.js';
import { parseEstatePlanning, parseWillsEpaEpg } from './sections/estatePlanning.js';
import { parseRiskProfiles } from './sections/riskProfile.js';
import {
  resolveOwnerIds, splitConcatenatedNames, firstName, normalizeName,
} from './utils.js';

let assetCounter = 0;
let liabilityCounter = 0;
let entityCounter = 0;
let familyCounter = 0;
let grandchildCounter = 0;
let goalCounter = 0;
let relCounter = 0;
let estateCounter = 0;

function resetCounters() {
  assetCounter = 0;
  liabilityCounter = 0;
  entityCounter = 0;
  familyCounter = 0;
  grandchildCounter = 0;
  goalCounter = 0;
  relCounter = 0;
  estateCounter = 0;
}

function nextAssetId(): string { return `asset-${++assetCounter}`; }
function nextLiabilityId(): string { return `liability-${++liabilityCounter}`; }
function nextEntityId(): string { return `entity-${++entityCounter}`; }
function nextFamilyId(): string { return `family-${++familyCounter}`; }
function nextGrandchildId(): string { return `grandchild-${++grandchildCounter}`; }
function nextGoalId(): string { return `goal-${++goalCounter}`; }
function nextRelId(): string { return `rel-${++relCounter}`; }
function nextEstateId(): string { return `estate-${++estateCounter}`; }

export function assemble(sections: Sections): FinancialPlan {
  resetCounters();

  // 1. Parse header for client names
  const header = parseHeader(sections.header);

  // 2. Parse personal details
  const details = parsePersonalDetails(sections.personalDetails);

  // 3. Build clients
  const clients: Client[] = details.map((d, i) => ({
    id: `client-${i + 1}`,
    name: d.fullName,
    age: d.age,
    occupation: d.occupation,
    income: null,
    superBalance: null,
    riskProfile: null,
  }));

  // If no clients from personal details, fall back to header names
  if (clients.length === 0 && header.clientNames.length > 0) {
    header.clientNames.forEach((name, i) => {
      clients.push({
        id: `client-${i + 1}`,
        name,
        age: null,
        occupation: null,
        income: null,
        superBalance: null,
        riskProfile: null,
      });
    });
  }

  // Known first names for concatenated name splitting
  const knownFirstNames = clients.map((c) => firstName(c.name));

  // Also gather adult children names for known names list
  const adultChildren = parseAdultChildren(sections.adultChildren);
  for (const ac of adultChildren) {
    const fn = firstName(ac.name);
    if (!knownFirstNames.includes(fn)) knownFirstNames.push(fn);
  }

  // 4. Parse income and sum per client
  const incomeItems = parseIncome(sections.income);
  const clientIncomes = new Map<string, number>();
  for (const item of incomeItems) {
    const ownerIds = resolveOwnerIds(item.owner, clients);
    for (const id of ownerIds) {
      clientIncomes.set(id, (clientIncomes.get(id) || 0) + (item.amount || 0));
    }
  }
  for (const client of clients) {
    const total = clientIncomes.get(client.id);
    if (total !== undefined && total > 0) client.income = total;
  }

  // 5. Parse personal assets
  const personalAssets: Asset[] = [];

  // Lifestyle assets
  const lifestyle = parsePersonalAssets(sections.lifestyleAssets, 'property');
  for (const item of lifestyle) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: item.type,
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // Bank accounts
  const banks = parsePersonalAssets(sections.bankAccounts, 'cash');
  for (const item of banks) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: item.type,
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // Financial investments
  const finInv = parsePersonalAssets(sections.financialInvestments, 'managed_fund');
  for (const item of finInv) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: item.type,
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // Shares
  const shares = parsePersonalAssets(sections.shares, 'shares');
  for (const item of shares) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: item.type,
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // Investment property
  const invProp = parseInvestmentProperty(sections.investmentProperty);
  for (const item of invProp) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: 'property',
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // Super + Pension → personalAssets + client.superBalance
  const superItems = parseSuperannuation(sections.superannuation);
  const pensionItems = parsePension(sections.pension);
  const superBalances = new Map<string, number>();

  for (const item of superItems) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: 'super',
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
    // Accumulate super balance
    const ownerIds = resolveOwnerIds(item.owner, clients);
    for (const id of ownerIds) {
      superBalances.set(id, (superBalances.get(id) || 0) + (item.amount || 0));
    }
  }

  for (const item of pensionItems) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.description,
      type: 'pension',
      value: item.amount,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
    // Pension does NOT count toward client.superBalance (only accumulation phase does)
  }

  // Insurance policies — cover amount is not an asset value, store in details for display
  const insuranceItems = parseInsurance(sections.insurance);
  for (const item of insuranceItems) {
    personalAssets.push({
      id: nextAssetId(),
      name: item.name,
      type: 'insurance',
      value: null,
      ownerIds: resolveOwnerIds(item.insuredPerson, clients),
      details: item.coverAmount ? `Cover: $${item.coverAmount.toLocaleString()}` : null,
    });
  }

  for (const client of clients) {
    const bal = superBalances.get(client.id);
    if (bal !== undefined && bal > 0) client.superBalance = bal;
  }

  // 6. Parse entities
  const entityStructures = parseEntityStructure(sections.entityStructure);
  const entityHoldings = parseEntityHoldings(sections.entityHoldings);

  // Build entities, deduplicating by name (merge if same name appears multiple times)
  const entityMap = new Map<string, Entity>();
  const consumedHoldings = new Set<number>(); // track consumed holding indices

  for (const es of entityStructures) {
    const key = normalizeName(es.name).toLowerCase();

    // Resolve linked clients from directors/beneficiaries
    const directorNames = splitConcatenatedNames(es.directors, knownFirstNames);
    const beneNames = splitConcatenatedNames(es.beneficiaries, knownFirstNames);
    const allNames = [...new Set([...directorNames, ...beneNames])];

    const linkedClientIds = allNames
      .map((name) => clients.find(
        (c) => firstName(c.name).toLowerCase() === name.toLowerCase() ||
               c.name.toLowerCase() === name.toLowerCase(),
      ))
      .filter(Boolean)
      .map((c) => c!.id);

    // Determine trustee info
    const trusteeName = es.directors || null;
    let trusteeType: 'individual' | 'corporate' | null = null;
    if (trusteeName) {
      trusteeType = /pty\s*ltd/i.test(trusteeName) ? 'corporate' : 'individual';
    }

    // Determine role
    const role = buildRole(directorNames, beneNames, clients);

    if (entityMap.has(key)) {
      // Merge: add linked clients to existing entity
      const existing = entityMap.get(key)!;
      for (const id of linkedClientIds) {
        if (!existing.linkedClientIds.includes(id)) {
          existing.linkedClientIds.push(id);
        }
      }
      if (!existing.trusteeName && trusteeName) {
        existing.trusteeName = normalizeName(trusteeName);
        existing.trusteeType = trusteeType;
      }
    } else {
      // Find ALL unclaimed matching holdings groups (exact match, then fuzzy suffix match)
      const entityAssets: Asset[] = [];
      const entityLiabilities: Liability[] = [];
      entityHoldings.forEach((h, idx) => {
        if (consumedHoldings.has(idx)) return;
        const holdingKey = normalizeName(h.entityName).toLowerCase();
        const isExact = holdingKey === key;
        // Fuzzy: one name is a suffix of the other (e.g. "Perosa Family Trust" matches "Pizzato Perosa Family Trust")
        const isFuzzy = !isExact && (key.endsWith(holdingKey) || holdingKey.endsWith(key));
        if (isExact || isFuzzy) {
          consumedHoldings.add(idx);
          for (const a of h.assets) {
            entityAssets.push({
              id: nextAssetId(),
              name: a.description,
              type: a.type,
              value: a.amount,
              ownerIds: [],
              details: a.rawType || null,
            });
          }
          for (const l of h.liabilities) {
            entityLiabilities.push({
              id: nextLiabilityId(),
              name: l.description,
              type: 'loan',
              amount: l.amount,
              interestRate: null,
              ownerIds: [],
              details: null,
            });
          }
        }
      });

      entityMap.set(key, {
        id: nextEntityId(),
        name: normalizeName(es.name),
        type: es.type,
        linkedClientIds: [...new Set(linkedClientIds)],
        role,
        trusteeName: trusteeName ? normalizeName(trusteeName) : null,
        trusteeType,
        assets: entityAssets,
        liabilities: entityLiabilities,
      });
    }
  }
  const entities = [...entityMap.values()];

  // 6b. Handle SMSF member balance entries to avoid double-counting
  // When an SMSF entity exists, member-level super entries duplicate the entity's value.
  // Entries explicitly labeled "member balance" get moved INTO the SMSF entity (gold pattern).
  // Other SMSF-specific entries ("Member X:", "SMSF ...", etc.) get dropped entirely.
  const smsfEntity = entities.find((e) => e.type === 'smsf');
  if (smsfEntity) {
    const shouldMoveToEntity = (name: string) => /member\s*balance/i.test(name);
    const shouldDrop = (name: string) =>
      /^Member\s/i.test(name) ||
      /^SMSF\s/i.test(name) ||
      /interest.*SMSF/i.test(name);

    for (let i = personalAssets.length - 1; i >= 0; i--) {
      const a = personalAssets[i];
      if (a.type !== 'super' && a.type !== 'pension') continue;
      if (shouldMoveToEntity(a.name)) {
        personalAssets.splice(i, 1);
        smsfEntity.assets.push({ ...a, type: 'super' });
      } else if (shouldDrop(a.name)) {
        personalAssets.splice(i, 1);
      }
    }
  }

  // 7. Parse loans/liabilities
  const personalLiabilities: Liability[] = [];
  const loanItems = parseLoans(sections.loans);
  for (const item of loanItems) {
    personalLiabilities.push({
      id: nextLiabilityId(),
      name: item.description,
      type: item.type,
      amount: item.amount,
      interestRate: item.interestRate,
      ownerIds: resolveOwnerIds(item.owner, clients),
      details: item.details || null,
    });
  }

  // 8. Parse goals
  const goalItems = parseGoals(sections.goals);
  const goals: Goal[] = goalItems.map((g) => ({
    id: nextGoalId(),
    name: g.name,
    category: g.category,
    detail: g.detail,
    timeframe: g.timeframe,
    value: g.value,
  }));

  // Extract objectives from goals
  const objectives = goals.map((g) => g.detail || g.name).filter(Boolean);

  // 9. Parse relationships/advisers
  const relItems = parseRelationships(sections.relationships);
  const relationships: Relationship[] = relItems.map((r) => ({
    id: nextRelId(),
    clientIds: resolveOwnerIds(r.from, clients),
    type: inferRelationshipType(r.relationship),
    firmName: null,
    contactName: r.to || null,
    notes: r.notes || null,
  }));

  // 10. Parse family members (dependants + adult children)
  const familyMembers: FamilyMember[] = [];

  // Financial dependants
  const depItems = parseDependants(sections.dependants);
  for (const dep of depItems) {
    familyMembers.push({
      id: nextFamilyId(),
      name: dep.name,
      relationship: inferChildRelationship(dep.name, dep.type),
      partner: null,
      age: ageFromDob(dep.dob),
      isDependant: true,
      details: null,
      children: [],
    });
  }

  // Adult children
  for (const ac of adultChildren) {
    // Check if already added as dependant
    const existing = familyMembers.find(
      (fm) => fm.name.toLowerCase() === ac.name.toLowerCase(),
    );
    if (existing) {
      // Merge info
      if (ac.employment && !existing.details) existing.details = ac.employment;
      continue;
    }

    // Parse grandchildren from the grandkids string
    const grandchildren: Grandchild[] = [];
    if (ac.grandkids) {
      const names = ac.grandkids.split(/\s*[&,]\s*/).map((n) => n.trim()).filter(Boolean);
      for (const gname of names) {
        grandchildren.push({
          id: nextGrandchildId(),
          name: gname,
          relationship: 'grandchild',
          age: null,
          isDependant: false,
          details: null,
        });
      }
    }

    familyMembers.push({
      id: nextFamilyId(),
      name: ac.name,
      relationship: 'other', // adult children are not sub-categorized in the source
      partner: null,
      age: null,
      isDependant: false,
      details: ac.employment,
      children: grandchildren,
    });
  }

  // 11. Parse estate planning
  const estatePlanning: EstatePlanItem[] = [];

  // Super nominations
  const nominations = parseEstatePlanning(sections.estatePlanning);
  for (const nom of nominations) {
    const ownerClient = clients.find(
      (c) => firstName(c.name).toLowerCase() === nom.owner.toLowerCase() ||
             c.name.toLowerCase() === nom.owner.toLowerCase(),
    );
    estatePlanning.push({
      id: nextEstateId(),
      clientId: ownerClient?.id || clients[0]?.id || 'client-1',
      type: 'super_nomination',
      status: nom.nominationType.toLowerCase() === 'unknown' ? null : 'current',
      lastReviewed: null,
      primaryPerson: null,
      alternatePeople: null,
      details: `${nom.nominationType}: ${nom.beneficiaries}`.trim(),
      hasIssue: nom.nominationType.toLowerCase() === 'unknown',
    });
  }

  // Wills, EPA, EPG
  const willItems = parseWillsEpaEpg(
    sections.willsEpaEpg,
    clients.map((c) => firstName(c.name)),
  );
  for (const w of willItems) {
    for (const cs of w.clientStatuses) {
      const client = clients.find(
        (c) => firstName(c.name).toLowerCase() === cs.name.toLowerCase(),
      );
      if (!client) continue;

      const status = parseWillStatus(cs.status);

      // For wills, the executor info might be in the status field
      let primaryPerson: string | null = null;
      if (w.type === 'will' && cs.status.toLowerCase() !== 'yes' &&
          cs.status.toLowerCase() !== 'not recorded' &&
          cs.status.toLowerCase() !== 'no') {
        primaryPerson = cs.status;
      }

      estatePlanning.push({
        id: nextEstateId(),
        clientId: client.id,
        type: w.type,
        status: status === 'yes' ? 'current' : status === 'not recorded' ? 'not_established' : status === 'no' ? 'not_established' : 'current',
        lastReviewed: null,
        primaryPerson,
        alternatePeople: null,
        details: null,
        hasIssue: status === 'not recorded' || status === 'no',
      });
    }
  }

  // 12. Parse risk profiles
  const riskItems = parseRiskProfiles(sections.riskProfile);
  for (const rp of riskItems) {
    // Match to client by first name
    const client = clients.find(
      (c) => firstName(c.name).toLowerCase() === rp.name.toLowerCase() ||
             c.name.toLowerCase() === rp.name.toLowerCase(),
    );
    if (client) {
      client.riskProfile = rp.profile;
    }
  }

  return {
    clients,
    entities,
    personalAssets,
    personalLiabilities,
    estatePlanning,
    familyMembers,
    objectives,
    goals,
    relationships,
    dataGaps: [],
  };
}

function buildRole(
  directorNames: string[],
  beneNames: string[],
  clients: Client[],
): string | null {
  const roles: string[] = [];

  const clientFirstNames = new Set(clients.map((c) => firstName(c.name).toLowerCase()));

  const isClientDirector = directorNames.some((n) => clientFirstNames.has(n.toLowerCase()));
  const isClientBene = beneNames.some((n) => clientFirstNames.has(n.toLowerCase()));

  if (isClientDirector) roles.push('Director/Trustee');
  if (isClientBene) roles.push('Beneficiary');

  return roles.length > 0 ? roles.join(' & ') : null;
}

function inferChildRelationship(_name: string, _type: string): 'child' | 'other' {
  return 'child';
}

function parseWillStatus(status: string): string {
  return status.toLowerCase().trim();
}
