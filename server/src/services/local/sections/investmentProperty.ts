/**
 * Parse "Investment property" section.
 * Multi-line detail format: Description | Owner | ...details... | $Amount
 */
import { splitCells, parseMultiLineItems } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';

export interface InvestmentPropertyItem {
  description: string;
  owner: string;
  details: string;
  amount: number | null;
}

export function parseInvestmentProperty(text: string | null): InvestmentPropertyItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find column headers
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  // Skip section title + column headers (Description, Owner, Details, Amount)
  const dataStart = headerIdx + 4;
  const dataCells = cells.slice(dataStart);

  // Filter out "Total" and any trailing amount
  const filtered = filterTotalCells(dataCells);

  const items = parseMultiLineItems(filtered);
  return items.map((item) => ({
    description: item.description,
    owner: item.owner,
    details: item.details.join('\n'),
    amount: parseDollar(item.amount),
  }));
}

function filterTotalCells(cells: string[]): string[] {
  // Find the first "Total" cell and cut there
  const totalIdx = cells.findIndex((c) => /^total$/i.test(c));
  return totalIdx >= 0 ? cells.slice(0, totalIdx) : cells;
}
