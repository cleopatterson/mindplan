/**
 * Parse "Relationships" section.
 * 4-column table: From | Relationship | To | Notes
 * Notes may be empty (omitted by mammoth).
 */
import { splitCells } from '../parseTable.js';
import { isNoInfoLine, normalizeName } from '../utils.js';
import type { Relationship } from 'shared/types';

export interface RelationshipItem {
  from: string;
  relationship: string;
  to: string;
  notes: string;
}

const RELATIONSHIP_KEYWORDS = [
  'accountant', 'stockbroker', 'solicitor', 'lawyer', 'legal',
  'estate planner', 'insurance', 'mortgage broker', 'financial adviser',
  'financial advisor', 'banker', 'auditor',
];

function isRelationshipType(cell: string): boolean {
  const lower = cell.trim().toLowerCase();
  return RELATIONSHIP_KEYWORDS.some((k) => lower.includes(k));
}

export function parseRelationships(text: string | null): RelationshipItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  const fromIdx = cells.findIndex((c) => /^From$/i.test(c));
  if (fromIdx < 0) return [];

  const dataStart = fromIdx + 4; // From, Relationship, To, Notes
  const dataCells = cells.slice(dataStart);

  // Find relationship type cells to anchor rows
  const items: RelationshipItem[] = [];
  let i = 0;
  while (i < dataCells.length) {
    // Find next relationship type keyword
    if (i + 1 < dataCells.length && isRelationshipType(dataCells[i + 1])) {
      const from = dataCells[i];
      const rel = dataCells[i + 1];
      const to = i + 2 < dataCells.length ? dataCells[i + 2] : '';

      // Check if there's a notes cell before the next "from" entry
      let notes = '';
      if (i + 3 < dataCells.length) {
        // Is the cell after "to" another "from" entry (followed by rel type)?
        if (i + 4 < dataCells.length && isRelationshipType(dataCells[i + 4])) {
          // i+3 is notes
          notes = dataCells[i + 3];
          i += 4;
        } else if (isRelationshipType(dataCells[i + 3]) ||
                   (i + 4 < dataCells.length && isRelationshipType(dataCells[i + 4]))) {
          // No notes, next row starts at i+3
          i += 3;
        } else {
          notes = dataCells[i + 3];
          i += 4;
        }
      } else {
        i += 3;
      }

      items.push({
        from: normalizeName(from),
        relationship: rel.trim(),
        to: normalizeName(to),
        notes: notes.trim(),
      });
    } else {
      i++;
    }
  }

  return items;
}

/** Map relationship string to type enum */
export function inferRelationshipType(relStr: string): Relationship['type'] {
  const r = relStr.toLowerCase().trim();
  if (/accountant/i.test(r)) return 'accountant';
  if (/stockbroker/i.test(r)) return 'stockbroker';
  if (/solicitor|lawyer|legal|estate\s*planner/i.test(r)) return 'solicitor';
  if (/insurance/i.test(r)) return 'insurance_adviser';
  if (/mortgage\s*broker/i.test(r)) return 'mortgage_broker';
  if (/financial\s*advi[sc]er/i.test(r)) return 'financial_adviser';
  return 'other';
}
