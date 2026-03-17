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
  category: 'retirement' | 'wealth' | 'protection' | 'estate' | 'lifestyle' | 'education' | 'other';
  value: number | null;
}

const CATEGORY_MAP: Record<string, GoalItem['category']> = {
  'retirement planning': 'retirement',
  'superannuation & pensions': 'retirement',
  'tax': 'wealth',
  'wealth accumulation': 'wealth',
  'wealth creation': 'wealth',
  'living & lifestyle': 'lifestyle',
  'estate planning': 'estate',
  'protection': 'protection',
  'insurance': 'protection',
  'risk management': 'protection',
  'education': 'education',
  'debt management': 'wealth',
  'other investments': 'wealth',
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

  // Detect 4-column layout: first cell is a known category AND cell at +3 is a timeframe
  // In 4-col layout, category rows are: [category, goalName, detail, timeframe]
  // Subsequent goals under same category are: [goalName, detail, timeframe] (3 cells)
  const firstCat = dataCells.length >= 4 ? matchCategory(dataCells[0]) : null;
  const fourCol = firstCat !== null && isTimeframeText(dataCells[3]?.trim() || '');

  const items: GoalItem[] = [];
  let currentCategory: GoalItem['category'] = 'other';

  let i = 0;
  while (i < dataCells.length) {
    const cell = dataCells[i].trim();

    if (fourCol) {
      // 4-column mode: check if this cell is a category header with a goal in the same row
      const catMatch = matchCategory(cell);
      if (catMatch && i + 3 < dataCells.length && isTimeframeText(dataCells[i + 3].trim())) {
        // 4-cell row: [category, name, detail, timeframe]
        currentCategory = catMatch;
        const name = dataCells[i + 1].trim();
        const detail = dataCells[i + 2].trim();
        const timeframe = dataCells[i + 3].trim();
        const value = extractValue(detail);
        items.push({ name, detail, timeframe, category: currentCategory, value });
        i += 4;
        continue;
      }
      // Otherwise a 3-cell goal row: [name, detail, timeframe]
      if (i + 2 < dataCells.length) {
        const name = cell;
        const detail = dataCells[i + 1].trim();
        const timeframe = dataCells[i + 2].trim();
        const value = extractValue(detail);
        items.push({ name, detail, timeframe: isTimeframeText(timeframe) ? timeframe : null, category: currentCategory, value });
        i += isTimeframeText(timeframe) ? 3 : 2;
      } else {
        i++;
      }
      continue;
    }

    // ── 3-column mode (original logic) ──

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
    if (lower === key || lower.startsWith(key)) return cat;
  }
  return null;
}

function isTimeframeText(text: string): boolean {
  return /^now$/i.test(text.trim()) ||
    /ongoing/i.test(text) ||
    /^\d{4}/i.test(text) ||
    /year/i.test(text) ||
    /month/i.test(text) ||
    /june|july|jan|feb|mar|apr|may|aug|sep|oct|nov|dec/i.test(text);
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
