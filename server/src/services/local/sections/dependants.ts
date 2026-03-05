/**
 * Parse "Financial dependants" and "Adult Children" sections.
 *
 * Financial dependants format (4-col): Dependant | Type | Date of birth | Dependant until
 * Adult Children format (4-col): Income | Employment | Grandkids (with name in first column)
 *
 * Adult Children is a custom table:
 *   Name row
 *   Income | Employment | Grandkids (these are the values, name is the header)
 */
import { splitCells } from '../parseTable.js';
import { isNoInfoLine, parseAge, parseDollar, normalizeName } from '../utils.js';
import type { FamilyMember, Grandchild } from 'shared/types';

export interface DependantItem {
  name: string;
  type: string;
  dob: string;
  dependantUntil: string;
}

export interface AdultChildItem {
  name: string;
  income: number | null;
  employment: string | null;
  grandkids: string | null; // raw string like "Chelsea & Liam"
}

export function parseDependants(text: string | null): DependantItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find column headers: Dependant, Type, Date of birth, Dependant until
  const depIdx = cells.findIndex((c) => /^Dependant$/i.test(c));
  if (depIdx < 0) return [];

  const dataStart = depIdx + 4;
  const dataCells = cells.slice(dataStart);

  // Parse with variable row length (mammoth omits empty cells).
  // Strategy: each row starts with a name (contains a space, not a date/type keyword).
  const items: DependantItem[] = [];
  let i = 0;
  while (i < dataCells.length) {
    const name = dataCells[i];
    if (!name || /^total$/i.test(name)) break;

    // Collect remaining cells until next name or end
    const rowCells: string[] = [];
    let j = i + 1;
    while (j < dataCells.length && !isLikelyName(dataCells[j], dataCells, j)) {
      rowCells.push(dataCells[j]);
      j++;
    }

    // rowCells may have: type, dob, dependantUntil (any can be missing)
    const type = rowCells.length > 0 ? rowCells[0] : '';
    const dob = rowCells.length > 1 ? rowCells[1] : '';
    const depUntil = rowCells.length > 2 ? rowCells[2] : '';

    items.push({
      name: normalizeName(name),
      type: type.trim(),
      dob: dob.trim(),
      dependantUntil: depUntil.trim(),
    });
    i = j;
  }

  return items;
}

/** Heuristic: a cell is likely a dependant name if it contains a space and doesn't look like a type/date */
function isLikelyName(cell: string, cells: string[], idx: number): boolean {
  const trimmed = cell.trim();
  // Names have spaces and are not keywords
  if (!trimmed.includes(' ')) return false;
  if (/^not specified$/i.test(trimmed)) return false;
  if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(trimmed)) return false; // date
  return true;
}

export function parseAdultChildren(text: string | null): AdultChildItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // The format is:
  // Adult Children
  // Income
  // Employment
  // Grandkids
  // <Name1>
  // <Income1>
  // <Employment1>
  // <Grandkids1>
  // ...

  // Find column headers: Income, Employment, Grandkids
  const incIdx = cells.findIndex((c) => /^Income$/i.test(c));
  if (incIdx < 0) return [];

  // Headers are: Income, Employment, Grandkids (3 headers)
  const dataStart = incIdx + 3;
  const dataCells = cells.slice(dataStart);

  // Each adult child is 4 cells: Name, Income, Employment, Grandkids
  // But some may have fewer if grandkids is empty
  const items: AdultChildItem[] = [];

  let i = 0;
  while (i < dataCells.length) {
    const name = dataCells[i];
    if (!name) { i++; continue; }

    // Next cells: income (dollar), employment (text), grandkids (text or empty)
    const incomeStr = i + 1 < dataCells.length ? dataCells[i + 1] : '';
    const employment = i + 2 < dataCells.length ? dataCells[i + 2] : '';

    // Check if income is a dollar value
    if (/^\$/.test(incomeStr)) {
      // 3 or 4 cells per item depending on grandkids
      const grandkidsStr = i + 3 < dataCells.length ? dataCells[i + 3] : '';

      // Check if grandkids cell is the next person's name (no grandkids)
      const hasGrandkids = grandkidsStr && !/^\$/.test(grandkidsStr) && !isNameFollowedByDollar(dataCells, i + 3);

      if (hasGrandkids) {
        items.push({
          name: normalizeName(name),
          income: parseDollar(incomeStr),
          employment: employment || null,
          grandkids: grandkidsStr || null,
        });
        i += 4;
      } else {
        items.push({
          name: normalizeName(name),
          income: parseDollar(incomeStr),
          employment: employment || null,
          grandkids: null,
        });
        i += 3;
      }
    } else {
      // Skip non-data cell
      i++;
    }
  }

  return items;
}

function isNameFollowedByDollar(cells: string[], idx: number): boolean {
  if (idx + 1 >= cells.length) return false;
  return /^\$/.test(cells[idx + 1]);
}

/** Calculate age from DOB string like "29 December 2009" */
export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const parsed = Date.parse(dob);
  if (isNaN(parsed)) return null;
  const birthDate = new Date(parsed);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age < 150 ? age : null;
}
