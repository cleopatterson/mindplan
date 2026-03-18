/**
 * Parse second "Entities" section — entity holdings/assets.
 * Format: Entity name header, then rows of Description | Type | Amount (3-column)
 * grouped under each entity.
 */
import { splitCells } from '../parseTable.js';
import { parseDollar, isNoInfoLine, normalizeName } from '../utils.js';
import { inferAssetType } from './personalAssets.js';
import type { AssetType } from 'shared/types';

export interface EntityLiabilityItem {
  description: string;
  amount: number | null;
}

export interface EntityHoldingGroup {
  entityName: string;
  assets: EntityHoldingItem[];
  liabilities: EntityLiabilityItem[];
}

export interface EntityHoldingItem {
  description: string;
  type: AssetType;
  amount: number | null;
  rawType: string;
}

export function parseEntityHoldings(text: string | null): EntityHoldingGroup[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);

  // Find the column headers: Description, Type, Amount
  const headerIdx = cells.findIndex((c) => /^Description$/i.test(c));
  if (headerIdx < 0) return [];

  // Skip "Entities", "Description", "Type", "Amount"
  const dataStart = headerIdx + 3;
  const dataCells = cells.slice(dataStart);

  // Parse: entity names appear as standalone headers before their asset rows
  // Entity assets are 3-cell groups: description, type, $amount
  // "Total" rows separate entities, but entity names also appear before assets

  const groups: EntityHoldingGroup[] = [];
  let currentEntity: string | null = null;
  let currentAssets: EntityHoldingItem[] = [];
  let currentLiabilities: EntityLiabilityItem[] = [];
  let i = 0;
  let justSeenTotal = false; // After Total row, next text cell is always an entity name

  while (i < dataCells.length) {
    const cell = dataCells[i];

    // Skip "Total" rows (Total + optional amount)
    if (/^total$/i.test(cell)) {
      // Skip total and its amount
      i++;
      // Skip blank-ish or dollar amount after Total
      while (i < dataCells.length && /^[\-\(]?\$/.test(dataCells[i])) i++;
      justSeenTotal = true;
      continue;
    }

    // Check if this cell is a standalone dollar amount (e.g. net income column)
    if (/^[\-\(]?\$/.test(cell)) {
      i++;
      continue;
    }

    // Check if next cell is an asset type keyword
    const nextCell = i + 1 < dataCells.length ? dataCells[i + 1] : '';
    const isAssetType = isKnownAssetType(nextCell);

    // Fallback: if next cell isn't a known type but the cell two ahead is a dollar
    // amount, this is likely an asset row with an unrecognised type (e.g. "Vineyard").
    // Treat it as an asset with type 'other' rather than misinterpreting as an entity name.
    const amountLookahead = i + 2 < dataCells.length ? dataCells[i + 2] : '';
    const looksLikeAssetRow = !isAssetType && !justSeenTotal && currentEntity &&
      nextCell.length > 0 && nextCell.length <= 45 &&
      !/^[\-\(]?\$/.test(nextCell) && /^[\-\(]?\$/.test(amountLookahead);

    if ((isAssetType || looksLikeAssetRow) && !justSeenTotal) {
      // This is an asset row: description, type, amount [, net income]
      const amountCell = i + 2 < dataCells.length ? dataCells[i + 2] : '';
      const amount = /^[\-\(]?\$/.test(amountCell) ? parseDollar(amountCell) : null;

      // Check if it's actually a liability type (negative amount)
      if (currentEntity && isLiabilityType(nextCell)) {
        currentLiabilities.push({
          description: cell,
          amount: amount !== null ? Math.abs(amount) : null,
        });
      } else if (currentEntity) {
        currentAssets.push({
          description: cell,
          type: inferEntityAssetType(nextCell),
          amount,
          rawType: nextCell,
        });
      }

      i += amount !== null || /^[\-\(]?\$/.test(amountCell) ? 3 : 2;
      // Skip optional net income column
      if (i < dataCells.length && /^[\-\(]?\$/.test(dataCells[i])) i++;
    } else if (!justSeenTotal && /loan|mortgage|credit|debt|borrow/i.test(cell) &&
               /^-\$|^\(-?\$/.test(nextCell)) {
      // Liability row: description (loan-like) followed by negative dollar amount (no type column)
      if (currentEntity) {
        const amount = parseDollar(nextCell);
        currentLiabilities.push({
          description: cell,
          amount: amount !== null ? Math.abs(amount) : null,
        });
      }
      i += 2;
    } else {
      // This is an entity name header — flush previous entity
      if (currentEntity && (currentAssets.length > 0 || currentLiabilities.length > 0)) {
        groups.push({
          entityName: normalizeName(currentEntity),
          assets: currentAssets,
          liabilities: currentLiabilities,
        });
      }
      currentEntity = cell;
      currentAssets = [];
      currentLiabilities = [];
      justSeenTotal = false;
      i++;
    }
  }

  // Push last entity
  if (currentEntity && (currentAssets.length > 0 || currentLiabilities.length > 0)) {
    groups.push({
      entityName: normalizeName(currentEntity),
      assets: currentAssets,
      liabilities: currentLiabilities,
    });
  }

  return groups;
}

function isKnownAssetType(s: string): boolean {
  const t = s.trim().toLowerCase();
  // Reject if too long to be a type keyword (types are typically < 40 chars)
  if (t.length > 45) return false;
  // Plutosoft entity asset categories (fixed list):
  // Cash, Investment portfolio, Shares, Property, Business assets,
  // Loan assets, Loans, Share in private company
  return /^cash$/i.test(t) ||
    /everyday\s*cash/i.test(s) ||
    /savings/i.test(s) ||
    /on-?line\s*saver/i.test(s) ||
    /term\s*deposit/i.test(s) ||
    /loan\s*offset/i.test(s) ||
    /investment\s*portfolio/i.test(s) ||
    /share\s*in\s*private\s*company/i.test(s) ||
    /^shares?$/i.test(t) ||
    /residential\s*(property|unit|home)/i.test(s) ||
    /commercial\s*property/i.test(s) ||
    /holiday\s*home/i.test(s) ||
    /apartment/i.test(s) ||
    /\bland\b/i.test(s) ||
    /^business\s*assets?$/i.test(s) ||
    /^business\b/i.test(s) ||
    /loan\s*assets?/i.test(s) ||
    /listed\s*on\s*asx/i.test(s) ||
    /listed\s*\(other/i.test(s) ||
    /unlisted/i.test(s) ||
    /property/i.test(s) ||
    /\bcar\b/i.test(s) ||
    /\bboat\b/i.test(s) ||
    /\bcaravan\b/i.test(s) ||
    /contents|furniture|jewellery|personal\s*effects/i.test(s) ||
    /^other$/i.test(s) ||
    isLiabilityType(s);
}

/** Check if a type string represents a liability */
function isLiabilityType(s: string): boolean {
  if (/loan\s*offset/i.test(s)) return false; // loan offset is a cash asset
  return /home\s*loan/i.test(s) ||
    /investment\s*loan/i.test(s) ||
    /\bloan\b/i.test(s) ||
    /mortgage/i.test(s) ||
    /credit\s*card/i.test(s);
}

function inferEntityAssetType(rawType: string): AssetType {
  return inferAssetType(rawType, '', 'other');
}
