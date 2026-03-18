/**
 * Parse "Goals and objectives" section.
 * 3-column table: Goal | Detail | Timeframe
 * Category headers are interspersed (e.g. "Retirement planning", "Living & Lifestyle")
 */
import { splitCells } from '../parseTable.js';
import { isNoInfoLine, parseDollar } from '../utils.js';

export interface GoalItem {
  name: string;
  detail: string | null;
  timeframe: string | null;
  category: 'retirement' | 'superannuation' | 'tax' | 'wealth' | 'protection' | 'estate' | 'lifestyle' | 'cash_reserve' | 'other_investments' | 'debt' | 'centrelink' | 'education' | 'regular_review' | 'other';
  value: number | null;
}

const CATEGORY_MAP: Record<string, GoalItem['category']> = {
  'retirement planning': 'retirement',
  'superannuation & pensions': 'superannuation',
  'superannuation': 'superannuation',
  'tax': 'tax',
  'tax planning': 'tax',
  'wealth accumulation': 'wealth',
  'wealth creation': 'wealth',
  'wealth management': 'wealth',
  'living & lifestyle': 'lifestyle',
  'estate planning': 'estate',
  'protection': 'protection',
  'insurance': 'protection',
  'risk management': 'protection',
  'asset protection': 'protection',
  'insurance and risk management': 'protection',
  'education': 'education',
  'cash reserve': 'cash_reserve',
  'other investments': 'other_investments',
  'debt & credit': 'debt',
  'debt management': 'debt',
  'centrelink': 'centrelink',
  'regular review': 'regular_review',
  'other': 'other',
};

const KNOWN_CATEGORIES = new Set(Object.keys(CATEGORY_MAP));

export function parseGoals(text: string | null): GoalItem[] {
  if (!text) return [];
  if (isNoInfoLine(text)) return [];

  const cells = splitCells(text);
  // Find column headers
  const goalIdx = cells.findIndex((c) => /^Goal$/i.test(c));
  if (goalIdx < 0) return [];

  // Skip "Goals and objectives", "Goal", "Detail", "Timeframe"
  const dataStart = goalIdx + 3;
  const dataCells = cells.slice(dataStart);

  const items: GoalItem[] = [];
  let currentCategory: GoalItem['category'] = 'other';

  let i = 0;
  while (i < dataCells.length) {
    const cell = dataCells[i].trim();

    // Check if this is a category header (not a goal name that happens to match a category)
    // A category header is standalone — if cell at i+2 looks like a timeframe, this is
    // actually a goal name in a 3-column row (goal, detail, timeframe).
    const catKey = cell.toLowerCase().replace(/\s+/g, ' ').trim();
    const catMatch = KNOWN_CATEGORIES.has(catKey) ? CATEGORY_MAP[catKey] : matchCategory(cell);
    if (catMatch && !looksLikeGoalRow(dataCells, i)) {
      currentCategory = catMatch;
      i++;
      continue;
    }

    // This should be a goal name, followed by detail and timeframe
    const name = cell;

    // Look ahead: is the next cell a category header? If so, this goal has no detail
    const nextCell = i + 1 < dataCells.length ? dataCells[i + 1] : null;
    const nextIsCategory = nextCell ? matchCategory(nextCell) !== null : false;

    if (nextIsCategory || !nextCell) {
      items.push({
        name,
        detail: null,
        timeframe: null,
        category: currentCategory,
        value: null,
      });
      i++;
      continue;
    }

    const detail = nextCell;

    // Is the cell after detail a category or a new goal name? (no timeframe)
    const timeframeCell = i + 2 < dataCells.length ? dataCells[i + 2] : null;
    const timeframeIsCategory = timeframeCell ? matchCategory(timeframeCell) !== null : false;

    // Check if timeframe looks like a real timeframe
    const isTimeframe = timeframeCell && !timeframeIsCategory && isTimeframeText(timeframeCell);

    const value = detail ? extractValue(detail) : null;

    if (isTimeframe) {
      items.push({
        name,
        detail,
        timeframe: timeframeCell,
        category: currentCategory,
        value,
      });
      i += 3;
    } else {
      items.push({
        name,
        detail,
        timeframe: null,
        category: currentCategory,
        value,
      });
      i += 2;
    }
  }

  return items;
}

function matchCategory(text: string): GoalItem['category'] | null {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower === key) return cat;
  }
  return null;
}

/**
 * Detect whether a cell is a timeframe value (e.g. "Ongoing", "Now", "2026/2027",
 * "From July 2030 onwards", "Ongoing to June 2031") vs a detail/description that
 * happens to contain time-related words (e.g. "cover your ongoing living expenses").
 *
 * Real timeframes are short and structured. Long sentences are descriptions.
 */
function isTimeframeText(text: string): boolean {
  const t = text.trim();
  if (t.length > 50) return false; // descriptions are long, timeframes are short
  // Real timeframes always start with one of these patterns.
  // Month names can appear in detail text (e.g. "by 31 December 2029") so
  // we don't match them as a standalone signal.
  return /^now$/i.test(t) ||
    /^ongoing/i.test(t) ||
    /^\d{4}/i.test(t) ||
    /^from\b/i.test(t);
}

/** Check if cell at idx starts a 3-column goal row (goal, detail, timeframe) */
function looksLikeGoalRow(cells: string[], idx: number): boolean {
  // If cell at idx+2 looks like a timeframe, this is a goal row, not a category header
  const tfCell = idx + 2 < cells.length ? cells[idx + 2].trim() : null;
  return tfCell !== null && isTimeframeText(tfCell);
}

function extractValue(detail: string): number | null {
  const match = detail.match(/\$[\d,]+/);
  if (match) return parseDollar(match[0]);
  return null;
}
