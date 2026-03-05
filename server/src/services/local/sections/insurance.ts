/**
 * Parse "Life Insurance, TPD, Trauma and Income Protection" section.
 * Extracts individual insurance policies/cover types.
 *
 * Format: 5-column header (Policy, Life insured, Policy owner, Features, Cover amount)
 * then variable-length rows per policy — each named policy or cover type entry
 * has a name, cover type, insured person, owner, feature details, and dollar amount.
 */
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine, normalizeName } from '../utils.js';

export interface InsuranceItem {
  name: string;
  insuredPerson: string;
  coverAmount: number | null;
}

const COVER_TYPES = [
  'life cover', 'tpd cover', 'trauma', 'income protection',
  'life insurance', 'total & permanent disability',
];

function isCoverType(cell: string): boolean {
  const lower = cell.trim().toLowerCase();
  return COVER_TYPES.some((t) => lower.startsWith(t));
}

function isFeatureDetail(cell: string): boolean {
  const lower = cell.trim().toLowerCase();
  return /^premium type:/i.test(lower) ||
    /^type:/i.test(lower) ||
    /^waiting period:/i.test(lower) ||
    /^benefit period:/i.test(lower) ||
    /^features:/i.test(lower) ||
    /^tpd definition:/i.test(lower) ||
    /^life cover buyback:/i.test(lower) ||
    /^trauma reinstatement:/i.test(lower);
}

export function parseInsurance(text: string | null): InsuranceItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // Find "Cover amount" header (last of the 5 headers)
  const coverIdx = cells.findIndex((c) => /^Cover amount$/i.test(c));
  if (coverIdx < 0) return [];

  const dataCells = cells.slice(coverIdx + 1);
  const items: InsuranceItem[] = [];

  // Strategy: scan for named policies and cover types.
  // A named policy starts with a recognizable name (contains " - " or known prefixes).
  // A cover type follows within the same policy group.
  // Dollar amounts mark the end of each entry.

  let currentPolicyGroup: string | null = null;
  let i = 0;

  while (i < dataCells.length) {
    const cell = dataCells[i].trim();
    if (!cell) { i++; continue; }

    // Dollar amount — skip (already captured or standalone)
    if (/^[\-\(]?\$/.test(cell)) {
      i++;
      continue;
    }

    // Feature detail — skip
    if (isFeatureDetail(cell)) {
      i++;
      continue;
    }

    // Check if this is a named policy
    // Cover type cells with " - " are actually named policies (e.g. "Income Protection Plan - Alicia")
    // because raw data sub-covers never include " - " (person name is in a separate cell)
    const matchesCoverType = isCoverType(cell);
    const isNamedPolicy = (matchesCoverType && /\s-\s/.test(cell)) ||
      (!matchesCoverType && (
        /\s-\s/.test(cell) ||                        // "TAL Insurances - Sarah"
        /insurance/i.test(cell) ||                    // "Resolution Life Insurance"
        /protection(?!\s*\(per)/i.test(cell) ||       // "Zurich Wealth Protection" (not "Income Protection (per month)")
        /\bsuper\b/i.test(cell) ||                    // "AustralianSuper - Ryan"
        /\bHBF\b|\bAIA\b|\bTAL\b|\bMLC\b/i.test(cell) || // known insurer abbreviations
        /^Life\s*&\s*TPD/i.test(cell)                 // "Life & TPD Any Occ"
      ));

    if (isNamedPolicy) {
      // This starts a new policy group
      currentPolicyGroup = cell;

      // Look ahead: find the insured person and cover amount
      let insured = '';
      let amount: number | null = null;

      // Scan forward for person name and dollar value
      let j = i + 1;
      while (j < dataCells.length && !/^[\-\(]?\$/.test(dataCells[j].trim())) {
        const c = dataCells[j].trim();
        if (!isFeatureDetail(c) && !isCoverType(c) && c.length < 40 && /^[A-Z]/.test(c)) {
          if (!insured) insured = c;
        }
        j++;
      }
      if (j < dataCells.length) {
        amount = parseDollar(dataCells[j].trim());
        j++;
      }

      items.push({
        name: cell,
        insuredPerson: normalizeName(insured),
        coverAmount: amount,
      });
      i = j;
    } else if (isCoverType(cell) && currentPolicyGroup) {
      // Sub-cover within a named policy group — skip it (the named policy is the item)
      let j = i + 1;
      while (j < dataCells.length && !/^[\-\(]?\$/.test(dataCells[j].trim())) {
        j++;
      }
      if (j < dataCells.length) j++; // skip the dollar amount too
      i = j;
    } else {
      // Unknown cell — might be a person name or something else, skip
      i++;
    }
  }

  return items;
}
