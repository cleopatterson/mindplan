/**
 * Parse "Your income" section.
 * Format: Description | Owner | Amount (3-column table)
 */
import { splitCells, groupRows } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';

export interface IncomeItem {
  description: string;
  owner: string;
  amount: number | null;
}

export function parseIncome(text: string | null): IncomeItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Skip section header ("Your income") and column headers ("Description", "Owner", "Amount")
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  // Check for "Owner" and "Amount" in the next cells
  const dataStart = headerIdx + 3; // skip Description, Owner, Amount headers
  const dataCells = cells.slice(dataStart);

  const rows = groupRows(dataCells, 3);
  const items: IncomeItem[] = [];

  for (const row of rows) {
    if (/^total$/i.test(row[0])) continue;
    items.push({
      description: row[0],
      owner: row[1],
      amount: parseDollar(row[2]),
    });
  }

  return items;
}
