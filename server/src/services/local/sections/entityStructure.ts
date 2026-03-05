/**
 * Parse first "Entities" section — entity structure definitions.
 *
 * Variable column layout since mammoth omits empty cells.
 * Strategy: find entity type keywords to anchor each row,
 * then the cell before the type is the name, cells after are directors/bene/appointor.
 */
import { splitCells } from '../parseTable.js';
import { isNoInfoLine, normalizeName } from '../utils.js';
import type { EntityType } from 'shared/types';

export interface EntityStructureItem {
  name: string;
  type: EntityType;
  directors: string;        // raw concatenated names
  beneficiaries: string;    // raw concatenated names
  appointor: string;        // raw appointor
}

export function parseEntityStructure(text: string | null): EntityStructureItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // Find the data start: after "Appointor" or "Shareholders/beneficiaries" header
  const appointorIdx = cells.findIndex((c) => /^Appointor$/i.test(c));
  const beneHeaderIdx = cells.findIndex((c) => /shareholders\/beneficiaries/i.test(c));
  const dataStart = (appointorIdx >= 0 ? appointorIdx : beneHeaderIdx >= 0 ? beneHeaderIdx : -1) + 1;
  if (dataStart <= 0) return [];

  const dataCells = cells.slice(dataStart);

  // Find all entity type keyword positions
  const typePositions: { idx: number; type: EntityType }[] = [];
  for (let i = 0; i < dataCells.length; i++) {
    const t = inferEntityType(dataCells[i]);
    if (t) typePositions.push({ idx: i, type: t });
  }

  const items: EntityStructureItem[] = [];

  for (let p = 0; p < typePositions.length; p++) {
    const { idx: typeIdx, type } = typePositions[p];
    // Name is the cell immediately before the type
    const name = typeIdx > 0 ? dataCells[typeIdx - 1] : '';
    if (!name) continue;

    // Cells after the type, up to the name of the next entity
    // Next entity's name is at typePositions[p+1].idx - 1
    const nextNameIdx = p + 1 < typePositions.length
      ? typePositions[p + 1].idx - 1
      : dataCells.length;

    const afterType = dataCells.slice(typeIdx + 1, nextNameIdx);

    // First cell after type = directors/trustees
    // Second cell after type = shareholders/beneficiaries
    // Third cell after type = appointor (if present)
    const directors = afterType.length > 0 ? afterType[0] : '';
    const beneficiaries = afterType.length > 1 ? afterType[1] : '';
    const appointor = afterType.length > 2 ? afterType[2] : '';

    items.push({
      name: normalizeName(name),
      type,
      directors,
      beneficiaries,
      appointor,
    });
  }

  return items;
}

export function inferEntityType(typeStr: string): EntityType | null {
  const trimmed = typeStr.trim();
  if (/^Trust\s*\(Discretionary\)$/i.test(trimmed)) return 'trust';
  if (/^Trust\s*\(Unit\)$/i.test(trimmed)) return 'trust';
  if (/^Trust\b/i.test(trimmed)) return 'trust';
  if (/^SMSF$/i.test(trimmed)) return 'smsf';
  if (/^Pty\s*Ltd$/i.test(trimmed)) return 'company';
  if (/^Company\s*\(Trading\)$/i.test(trimmed)) return 'company';
  if (/^Company\s*\(Corporate\s*trustee\)$/i.test(trimmed)) return 'company';
  if (/^Company\b/i.test(trimmed)) return 'company';
  if (/^Partnership$/i.test(trimmed)) return 'partnership';
  return null;
}
