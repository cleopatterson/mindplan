/**
 * Parse "Regular expenses" section.
 * Format: Description | Owner | Details | Amount (4-column table)
 *
 * Section text may include a "One off expenses" sub-table after the first "Total"
 * row — we stop at the first "Total" to avoid picking those up.
 */
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';

export interface ExpenseItem {
  description: string;
  owner: string;
  details: string | null;
  amount: number | null;
}

export function parseExpenses(text: string | null): ExpenseItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  const dataStart = headerIdx + 4; // skip Description, Owner, Details, Amount headers
  const items: ExpenseItem[] = [];

  for (let i = dataStart; i <= cells.length - 4; i += 4) {
    // Stop at "Total" row — anything after is a different table
    if (/^total$/i.test(cells[i])) break;
    items.push({
      description: cells[i],
      owner: cells[i + 1],
      details: cells[i + 2] || null,
      amount: parseDollar(cells[i + 3]),
    });
  }

  return items;
}
