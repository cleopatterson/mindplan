/**
 * Parse personal asset sections: Lifestyle assets, Bank accounts, Financial investments, Shares.
 * All use the same 4-column format: Description | Owner | Details | Amount
 */
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine } from '../utils.js';
import type { AssetType } from 'shared/types';

export interface PersonalAssetItem {
  description: string;
  owner: string;
  details: string;
  amount: number | null;
  type: AssetType;
}

/**
 * Parse a 4-column personal asset section.
 * Uses dollar-value anchoring to handle rows with extra detail cells.
 * @param text Section text
 * @param defaultType Default asset type for this section
 */
export function parsePersonalAssets(
  text: string | null,
  defaultType: AssetType,
): PersonalAssetItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find column headers
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  // Skip section title + column headers (Description, Owner, Details, Amount)
  const dataStart = headerIdx + 4;
  const dataCells = cells.slice(dataStart);

  // Filter out total rows
  const totalIdx = dataCells.findIndex((c) => /^total$/i.test(c));
  const filtered = totalIdx >= 0 ? dataCells.slice(0, totalIdx) : dataCells;

  // Use dollar-value anchoring: find each $-prefixed cell as the Amount,
  // then work backwards to identify Description, Owner, Details
  const items: PersonalAssetItem[] = [];
  let prevEnd = -1;

  for (let i = 0; i < filtered.length; i++) {
    if (/^-?\$/.test(filtered[i])) {
      const startIdx = prevEnd + 1;
      if (startIdx >= i) { prevEnd = i; continue; }

      const description = filtered[startIdx];
      const owner = startIdx + 1 < i ? filtered[startIdx + 1] : '';
      // All cells between owner and amount are details
      const detailParts: string[] = [];
      for (let j = startIdx + 2; j < i; j++) {
        detailParts.push(filtered[j]);
      }
      const details = detailParts.join(' | ');
      const type = inferAssetType(details, description, defaultType);

      items.push({
        description,
        owner,
        details,
        amount: parseDollar(filtered[i]),
        type,
      });
      prevEnd = i;
    }
  }

  return items;
}

/** Infer asset type from details string or description */
export function inferAssetType(details: string, description: string, defaultType: AssetType): AssetType {
  const d = details.toLowerCase();
  const desc = description.toLowerCase();

  // Property types
  if (/residential\s*(home|property|unit)/i.test(details)) return 'property';
  if (/commercial\s*property/i.test(details)) return 'property';
  if (/holiday\s*home/i.test(details)) return 'property';
  if (/\bland\b/i.test(details)) return 'property';
  if (/apartment/i.test(details)) return 'property';

  // Cash types
  if (/everyday\s*cash/i.test(details)) return 'cash';
  if (/savings/i.test(details)) return 'cash';
  if (/on-?line\s*saver/i.test(details)) return 'cash';
  if (/term\s*deposit/i.test(details)) return 'cash';
  if (/loan\s*offset/i.test(details)) return 'cash';

  // Vehicle
  if (/\bcar\b/i.test(details)) return 'vehicle';
  if (/\bboat\b/i.test(details)) return 'vehicle';
  if (/\bcaravan\b/i.test(details)) return 'vehicle';

  // Investment types
  if (/investment\s*portfolio/i.test(details)) {
    if (/\bshares?\b/i.test(description)) return 'shares';
    return 'managed_fund';
  }
  if (/listed\s*on\s*asx/i.test(details)) return 'shares';
  if (/listed\s*\(other/i.test(details)) return 'shares';
  if (/unlisted/i.test(details)) return defaultType === 'shares' ? 'shares' : 'other';

  // Contents/personal
  if (/contents|furniture|jewellery|personal\s*effects/i.test(d)) return 'other';

  // Explicit "Other" type string
  if (/^other$/i.test(details.trim())) return 'other';

  return defaultType;
}
