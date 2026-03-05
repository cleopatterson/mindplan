/**
 * Generic line-per-cell table parser for mammoth raw text output.
 *
 * Mammoth puts each table cell on its own line separated by blank lines.
 * This parser groups non-blank lines into rows based on a known column count.
 */

/** Split raw text into non-blank trimmed lines (cells) */
export function splitCells(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Group cells into fixed-width rows.
 * Skips rows that start with "Total" in the first cell.
 */
export function groupRows(cells: string[], colCount: number): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i <= cells.length - colCount; i += colCount) {
    const row = cells.slice(i, i + colCount);
    // Skip total rows
    if (/^total$/i.test(row[0])) {
      // Total rows might be 1 or colCount cells — skip the right amount
      continue;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Parse a multi-line detail section (investment property, loans).
 * These have variable-length detail blocks between Owner and Amount.
 * Format: Description, Owner, ...details lines..., $Amount
 *
 * Returns items grouped by dollar-value anchoring: the Amount cell is
 * identified by `$` or `-$` prefix.
 */
export interface MultiLineItem {
  description: string;
  owner: string;
  details: string[];
  amount: string; // raw dollar string
}

export function parseMultiLineItems(cells: string[]): MultiLineItem[] {
  const items: MultiLineItem[] = [];

  // Find the indices of dollar amounts to anchor items
  const amountIndices: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (/^-?\$/.test(cells[i]) && !/^\$0*$/.test('')) {
      amountIndices.push(i);
    }
  }

  // For each amount, work backwards to find the item structure
  // The pattern is: Description, Owner, ...detail lines..., $Amount
  let prevEnd = -1; // end of previous item's amount

  for (const amtIdx of amountIndices) {
    // Skip if this is a total row
    if (amtIdx > 0 && /^total$/i.test(cells[amtIdx - 1])) continue;
    // Also skip standalone total amounts
    const textBefore = amtIdx > 0 ? cells[amtIdx - 1] : '';
    if (/^total$/i.test(textBefore)) continue;

    // Find the start of this item: it's right after prevEnd
    const startIdx = prevEnd + 1;
    if (startIdx >= amtIdx) continue;

    // First cell is description, second is owner, rest up to amount are details
    const description = cells[startIdx];
    const owner = startIdx + 1 < amtIdx ? cells[startIdx + 1] : '';
    const details: string[] = [];
    for (let i = startIdx + 2; i < amtIdx; i++) {
      details.push(cells[i]);
    }

    items.push({ description, owner, details, amount: cells[amtIdx] });
    prevEnd = amtIdx;
  }

  return items;
}
