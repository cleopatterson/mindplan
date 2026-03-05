/**
 * Parse "Estate Planning" and "Wills, EPA, EPG" sections.
 *
 * Estate Planning (super nominations):
 *   Superannuation/pension fund | Owner | Nomination type | Beneficiaries (4-col)
 *
 * Wills, EPA, EPG:
 *   Single client: Description | Executors (2-col)
 *   Dual client: Description | Client1 | Client2 (3-col)
 */
import { splitCells, groupRows } from '../parseTable.js';
import { isNoInfoLine, normalizeName } from '../utils.js';

export interface SuperNominationItem {
  fundName: string;
  owner: string;
  nominationType: string;
  beneficiaries: string;
}

export interface WillItem {
  type: 'will' | 'poa' | 'guardianship';
  /** Per-client status: { clientName: status } */
  clientStatuses: { name: string; status: string }[];
}

export function parseEstatePlanning(text: string | null): SuperNominationItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find headers: Superannuation/pension fund, Owner, Nomination type, Beneficiaries
  const headerIdx = cells.findIndex((c) => /superannuation\/pension/i.test(c));
  if (headerIdx < 0) return [];

  const dataStart = headerIdx + 4;
  const dataCells = cells.slice(dataStart);

  const rows = groupRows(dataCells, 4);
  const items: SuperNominationItem[] = [];

  for (const row of rows) {
    if (/^total$/i.test(row[0])) continue;
    items.push({
      fundName: row[0].trim(),
      owner: row[1].trim(),
      nominationType: row[2].trim(),
      beneficiaries: row[3].trim(),
    });
  }

  return items;
}

export function parseWillsEpaEpg(
  text: string | null,
  clientNames: string[],
): WillItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // Find the Description header
  const descIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (descIdx < 0) return [];

  const isDual = clientNames.length > 1;
  const colCount = isDual ? 3 : 2;
  const dataStart = descIdx + colCount;
  const dataCells = cells.slice(dataStart);

  const items: WillItem[] = [];

  const rows = groupRows(dataCells, colCount);
  for (const row of rows) {
    const desc = row[0].trim().toLowerCase();
    let type: WillItem['type'] | null = null;
    if (/^will$/i.test(row[0].trim())) type = 'will';
    else if (/enduring\s*power\s*of\s*attorney/i.test(row[0])) type = 'poa';
    else if (/enduring\s*power\s*of\s*guardianship/i.test(row[0])) type = 'guardianship';

    if (!type) continue;

    const statuses: { name: string; status: string }[] = [];
    if (isDual) {
      statuses.push(
        { name: clientNames[0], status: row[1].trim() },
        { name: clientNames[1], status: row[2].trim() },
      );
    } else {
      statuses.push({ name: clientNames[0], status: row[1].trim() });
    }

    items.push({ type, clientStatuses: statuses });
  }

  return items;
}
