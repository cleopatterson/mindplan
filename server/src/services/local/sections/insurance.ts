/**
 * Parse "Life Insurance, TPD, Trauma and Income Protection" section.
 * Extracts individual cover types per policy with cover amounts.
 *
 * Format: 5-column header (Policy, Life insured, Policy owner, Features, Cover amount)
 * then variable-length rows per policy — each named policy contains sub-covers
 * (Life, TPD, Trauma, Income Protection) with individual amounts.
 */
import type { InsuranceCoverType } from 'shared/types';
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine, normalizeName } from '../utils.js';

export interface ParsedInsuranceCover {
  coverType: InsuranceCoverType;
  insuredPerson: string;
  owner: string;
  policyName: string;
  coverAmount: number | null;
  details: string | null;
}

const COVER_TYPE_MAP: [RegExp, InsuranceCoverType][] = [
  [/^life\s*(cover|insurance)/i, 'life'],
  [/^tpd\s*cover/i, 'tpd'],
  [/^total\s*&?\s*permanent/i, 'tpd'],
  [/^trauma/i, 'trauma'],
  [/^income\s*protection/i, 'income_protection'],
];

function matchCoverType(cell: string): InsuranceCoverType | null {
  const trimmed = cell.trim();
  for (const [re, type] of COVER_TYPE_MAP) {
    if (re.test(trimmed)) return type;
  }
  return null;
}

function isFeatureDetail(cell: string): boolean {
  return /^(premium type|type|waiting period|benefit period|features|tpd definition|life cover buyback|trauma reinstatement):/i.test(cell.trim());
}

function isDollar(cell: string): boolean {
  return /^[-\(]?\$/.test(cell.trim());
}

function isNamedPolicy(cell: string): boolean {
  const trimmed = cell.trim();
  if (!trimmed) return false;
  // "Super - ..." is an owner field (e.g. "Super - MLC: Aaron"), not a policy name
  if (/^super\s*-/i.test(trimmed)) return false;
  // Cover type cells with " - " are named policies (e.g. "Income Protection Plan - Alicia")
  if (matchCoverType(trimmed) && /\s-\s/.test(trimmed)) return true;
  if (matchCoverType(trimmed)) return false;
  // "Provider: PersonName" pattern (e.g. "CareSuper: Aaron Scagliotta", "Asteron: Heizel")
  // Exclude feature detail lines (e.g. "Premium type: Stepped", "TPD definition: Any")
  if (!isFeatureDetail(trimmed) && /^[A-Z][A-Za-z\s]+:\s+[A-Z]/.test(trimmed)) return true;
  return (
    /\s-\s/.test(trimmed) ||
    /insurance/i.test(trimmed) ||
    /protection(?!\s*\(per)/i.test(trimmed) ||
    /\bsuper\b/i.test(trimmed) ||
    /\bHBF\b|\bAIA\b|\bTAL\b|\bMLC\b/i.test(trimmed) ||
    /^Life\s*&\s*TPD/i.test(trimmed)
  );
}

export function parseInsurance(text: string | null): ParsedInsuranceCover[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // Find "Cover amount" header (last of the 5 headers)
  const coverIdx = cells.findIndex((c) => /^Cover amount$/i.test(c));
  if (coverIdx < 0) return [];

  const dataCells = cells.slice(coverIdx + 1);
  const items: ParsedInsuranceCover[] = [];

  let currentPolicy: string = '';
  let i = 0;

  while (i < dataCells.length) {
    const cell = dataCells[i].trim();
    if (!cell) { i++; continue; }

    // Dollar amount — skip (captured by cover/policy scan-ahead)
    if (isDollar(cell)) { i++; continue; }

    // Feature detail — skip
    if (isFeatureDetail(cell)) { i++; continue; }

    // Named policy — set as current group, then check if it also has a cover entry
    if (isNamedPolicy(cell)) {
      currentPolicy = cell;

      // A named policy that is ALSO a cover type (e.g. "Life & TPD Any Occ")
      // Extract its cover inline — but only if scanAhead finds real data
      const inlineCoverType = matchCoverType(cell);
      if (inlineCoverType) {
        const { insured, owner, amount, features, nextIdx } = scanAhead(dataCells, i + 1);
        // Only create cover if scanAhead found an amount or insured person
        // (otherwise this is just a policy header with sub-covers following)
        if (amount !== null || insured) {
          items.push({
            coverType: inlineCoverType,
            insuredPerson: normalizeName(insured),
            owner,
            policyName: currentPolicy,
            coverAmount: amount,
            details: features || null,
          });
        }
        i = nextIdx;
      } else {
        // Just a policy header — check if the very next cell is a cover type
        // If not, this policy might have no sub-covers (standalone, skip to next meaningful cell)
        i++;
      }
      continue;
    }

    // Cover type within a policy group
    const coverType = matchCoverType(cell);
    if (coverType) {
      const { insured, owner, amount, features, nextIdx } = scanAhead(dataCells, i + 1);
      items.push({
        coverType,
        insuredPerson: normalizeName(insured),
        owner,
        policyName: currentPolicy,
        coverAmount: amount,
        details: features || null,
      });
      i = nextIdx;
      continue;
    }

    // Unknown cell — skip (person name or other text outside expected structure)
    i++;
  }

  return items;
}

/**
 * Scan forward from position to collect insured person, owner, features, and dollar amount
 * for a single cover entry.
 */
function scanAhead(cells: string[], start: number): {
  insured: string; owner: string; amount: number | null; features: string; nextIdx: number;
} {
  let insured = '';
  let owner = '';
  let amount: number | null = null;
  const featureParts: string[] = [];
  let j = start;

  while (j < cells.length) {
    const c = cells[j].trim();
    if (!c) { j++; continue; }

    // Hit the next cover type or policy — stop
    if (matchCoverType(c) || isNamedPolicy(c)) break;

    // Dollar amount — capture and stop
    if (isDollar(c)) {
      amount = parseDollar(c);
      j++;
      break;
    }

    // Feature detail — capture
    if (isFeatureDetail(c)) {
      featureParts.push(c);
      j++;
      continue;
    }

    // Short text starting with uppercase — person name or owner
    if (c.length < 60 && /^[A-Z]/.test(c)) {
      if (!insured) {
        insured = c;
      } else if (!owner) {
        owner = c;
      }
    }

    j++;
  }

  return {
    insured,
    owner,
    amount,
    features: featureParts.join('; '),
    nextIdx: j,
  };
}
