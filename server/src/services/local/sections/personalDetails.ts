/**
 * Parse personal details section.
 *
 * Single client format:
 *   Description | Client
 *   Full name   | Dorothy June Smith
 *   Date of birth | 19 May 1951
 *   Age         | 74
 *
 * Dual client format:
 *   Description | Client      | Partner
 *   Full name   | Miles Ashton | Nerine Ashton
 *   Date of birth | ...       | ...
 *   Age         | 51          | 52
 *   Occupation  | Director    | Retail Manager
 */
import { splitCells } from '../parseTable.js';
import { normalizeName, parseAge } from '../utils.js';

export interface PersonalDetail {
  fullName: string;
  age: number | null;
  occupation: string | null;
}

export function parsePersonalDetails(text: string): PersonalDetail[] {
  const cells = splitCells(text);
  if (cells.length === 0) return [];

  // Detect if dual client by looking for "Partner" in the header row
  const isDual = cells.some((c) => /^Partner$/i.test(c));

  const results: PersonalDetail[] = [];

  if (isDual) {
    // Dual client: 3-column table (Description, Client, Partner)
    const detail1: PersonalDetail = { fullName: '', age: null, occupation: null };
    const detail2: PersonalDetail = { fullName: '', age: null, occupation: null };

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i].trim();
      if (/^Full name$/i.test(cell)) {
        detail1.fullName = normalizeName(cells[i + 1] || '');
        detail2.fullName = normalizeName(cells[i + 2] || '');
      } else if (/^Age$/i.test(cell) && !/^Aged care/i.test(cell)) {
        detail1.age = parseAge(cells[i + 1]);
        detail2.age = parseAge(cells[i + 2]);
      } else if (/^Occupation$/i.test(cell)) {
        detail1.occupation = cleanOccupation(cells[i + 1]);
        detail2.occupation = cleanOccupation(cells[i + 2]);
      }
    }

    if (detail1.fullName) results.push(detail1);
    if (detail2.fullName) results.push(detail2);
  } else {
    // Single client: 2-column table (Description, Client)
    const detail: PersonalDetail = { fullName: '', age: null, occupation: null };

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i].trim();
      if (/^Full name$/i.test(cell) && i + 1 < cells.length) {
        detail.fullName = normalizeName(cells[i + 1]);
      } else if (/^Age$/i.test(cell) && !/^Aged care/i.test(cell) && i + 1 < cells.length) {
        detail.age = parseAge(cells[i + 1]);
      } else if (/^Occupation$/i.test(cell) && i + 1 < cells.length) {
        detail.occupation = cleanOccupation(cells[i + 1]);
      }
    }

    if (detail.fullName) results.push(detail);
  }

  return results;
}

function cleanOccupation(s: string | undefined): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed || /^#/.test(trimmed) || /not specified/i.test(trimmed)) return null;
  return trimmed;
}
