/**
 * Parse "Loans" section.
 * Multi-line detail format: Description | Owner | ...detail lines... | -$Amount
 */
import { splitCells, parseMultiLineItems } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';
import type { LiabilityType } from 'shared/types';

export interface LoanItem {
  description: string;
  owner: string;
  details: string;
  amount: number | null;
  type: LiabilityType;
  interestRate: number | null;
}

export function parseLoans(text: string | null): LoanItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  const dataStart = headerIdx + 4; // Description, Owner, Details, Amount
  const dataCells = cells.slice(dataStart);

  // Filter out total
  const totalIdx = dataCells.findIndex((c) => /^total$/i.test(c));
  const filtered = totalIdx >= 0 ? dataCells.slice(0, totalIdx) : dataCells;

  const items = parseMultiLineItems(filtered);

  return items.map((item) => {
    const detailText = item.details.join('\n');
    return {
      description: item.description,
      owner: item.owner,
      details: detailText,
      amount: parseDollar(item.amount),
      type: inferLiabilityType(item.description, detailText),
      interestRate: extractInterestRate(detailText),
    };
  });
}

function inferLiabilityType(description: string, details: string): LiabilityType {
  const combined = (description + ' ' + details).toLowerCase();
  if (/home\s*loan/i.test(combined) || /mortgage/i.test(combined)) return 'mortgage';
  if (/credit\s*card/i.test(combined)) return 'credit_card';
  if (/investment\s*loan/i.test(combined) || /margin\s*loan/i.test(combined)) return 'loan';
  if (/\bloan\b/i.test(combined)) return 'loan';
  return 'other';
}

function extractInterestRate(details: string): number | null {
  const match = details.match(/interest\s*rate:\s*([\d.]+)%/i);
  if (match) return parseFloat(match[1]);
  return null;
}
