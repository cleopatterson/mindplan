/**
 * Parse Superannuation and Pension sections.
 * Both use 4-column format: Description | Owner | Details | Amount
 * Super maps to type 'super', Pension maps to type 'pension'.
 */
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';
import type { AssetType } from 'shared/types';

export interface SuperPensionItem {
  description: string;
  owner: string;
  details: string;
  amount: number | null;
  type: AssetType; // 'super' or 'pension'
}

export function parseSuperannuation(text: string | null): SuperPensionItem[] {
  return parseSuperSection(text, 'super');
}

export function parsePension(text: string | null): SuperPensionItem[] {
  return parseSuperSection(text, 'pension');
}

function parseSuperSection(text: string | null, type: AssetType): SuperPensionItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find column headers
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  // Skip section title + column headers
  const dataStart = headerIdx + 4;
  const dataCells = cells.slice(dataStart);

  // Group into rows of 4, but some detail cells have multiple lines
  // Use dollar-value anchoring: find each $amount and work backwards
  const items: SuperPensionItem[] = [];
  let i = 0;

  while (i < dataCells.length) {
    // Skip Total rows
    if (/^total$/i.test(dataCells[i])) break;

    // Find the next dollar amount
    let amtIdx = -1;
    for (let j = i + 1; j < dataCells.length; j++) {
      if (/^-?\$/.test(dataCells[j])) {
        amtIdx = j;
        break;
      }
    }
    if (amtIdx < 0) break;

    const description = dataCells[i];
    const owner = i + 1 < amtIdx ? dataCells[i + 1] : '';
    // Everything between owner and amount is details
    const detailParts: string[] = [];
    for (let j = i + 2; j < amtIdx; j++) {
      detailParts.push(dataCells[j]);
    }

    items.push({
      description,
      owner,
      details: detailParts.join('\n'),
      amount: parseDollar(dataCells[amtIdx]),
      type,
    });

    i = amtIdx + 1;
  }

  return items;
}
