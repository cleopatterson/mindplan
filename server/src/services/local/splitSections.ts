/**
 * Split mammoth raw text into named sections using ordered landmark detection.
 *
 * The Plutosoft "Client Fact Find" .docx has a fixed section order.
 * We scan for each landmark in sequence and extract the text between them.
 */

export interface Sections {
  header: string;           // "Prepared for" block
  personalDetails: string;  // Client/partner personal details table
  dependants: string | null;
  adultChildren: string | null;
  relationships: string | null;
  goals: string | null;
  income: string | null;
  entityStructure: string | null;  // First "Entities" — Directors/trustees
  entityHoldings: string | null;   // Second "Entities" — Description/Type/Amount
  regularExpenses: string | null;
  lifestyleAssets: string | null;
  bankAccounts: string | null;
  insurance: string | null;
  financialInvestments: string | null;
  investmentProperty: string | null;
  superannuation: string | null;
  pension: string | null;
  shares: string | null;
  loans: string | null;
  estatePlanning: string | null;
  willsEpaEpg: string | null;
  riskProfile: string | null;
}

/**
 * Ordered landmarks. Each has:
 * - key: section name in the Sections interface
 * - pattern: regex to match the section header line
 * - consume: if true, the matched line is included in the section text
 */
interface Landmark {
  key: keyof Sections;
  pattern: RegExp;
  /** Optional: disambiguate duplicate patterns using a sub-header check */
  subHeader?: RegExp;
}

const STOP_PATTERN = /^CLIENT ACKNOWLEDGEMENT/;

export function splitSections(rawText: string): Sections {
  // Split into lines for scanning
  const lines = rawText.split('\n');

  // Find section boundaries using landmark detection
  const sections: Sections = {
    header: '',
    personalDetails: '',
    dependants: null,
    adultChildren: null,
    relationships: null,
    goals: null,
    income: null,
    entityStructure: null,
    entityHoldings: null,
    regularExpenses: null,
    lifestyleAssets: null,
    bankAccounts: null,
    insurance: null,
    financialInvestments: null,
    investmentProperty: null,
    superannuation: null,
    pension: null,
    shares: null,
    loans: null,
    estatePlanning: null,
    willsEpaEpg: null,
    riskProfile: null,
  };

  // Extract header: from start to "FACT FIND QUESTIONNAIRE"
  const factFindIdx = lines.findIndex((l) => /^FACT FIND QUESTIONNAIRE/i.test(l.trim()));
  if (factFindIdx >= 0) {
    sections.header = lines.slice(0, factFindIdx).join('\n');
  }

  // Find "Personal details" section start
  const personalIdx = findLineIndex(lines, 0, /^Personal details$/i);
  if (personalIdx >= 0) {
    // Find the next section landmark after personal details
    const nextSection = findNextLandmark(lines, personalIdx + 1);
    sections.personalDetails = lines.slice(personalIdx, nextSection).join('\n');
  }

  // Find sections using ordered landmark scanning
  // We scan from the personal details section onwards
  const startFrom = personalIdx >= 0 ? personalIdx + 1 : 0;

  // Financial dependants
  const depIdx = findLineIndex(lines, startFrom, /^Financial dependants$/i);
  if (depIdx >= 0) {
    const end = findNextLandmark(lines, depIdx + 1);
    sections.dependants = lines.slice(depIdx, end).join('\n');
  }

  // Adult Children
  const adultIdx = findLineIndex(lines, startFrom, /^Adult Children$/i);
  if (adultIdx >= 0) {
    const end = findNextLandmark(lines, adultIdx + 1);
    sections.adultChildren = lines.slice(adultIdx, end).join('\n');
  }

  // Relationships
  const relIdx = findLineIndex(lines, startFrom, /^Relationships$/i);
  if (relIdx >= 0) {
    const end = findNextLandmark(lines, relIdx + 1);
    sections.relationships = lines.slice(relIdx, end).join('\n');
  }

  // Goals and objectives — ends at "Financial position" (not generic landmark,
  // because "Estate Planning" can appear as a category header within goals)
  const goalIdx = findLineIndex(lines, startFrom, /^Goals and objectives$/i);
  if (goalIdx >= 0) {
    const goalEnd = findLineIndex(lines, goalIdx + 1, /^Financial position$/i);
    const end = goalEnd >= 0 ? goalEnd : findNextLandmark(lines, goalIdx + 1);
    sections.goals = lines.slice(goalIdx, end).join('\n');
  }

  // Your income
  const incIdx = findLineIndex(lines, startFrom, /^Your income$/i);
  if (incIdx >= 0) {
    const end = findNextLandmark(lines, incIdx + 1);
    sections.income = lines.slice(incIdx, end).join('\n');
  }

  // Entities — Two sections with same header, disambiguated by sub-headers
  // First: has "Directors/trustees" sub-header
  // Second: has "Description" + "Type" + "Amount" but NOT "Directors"
  const entityIndices: number[] = [];
  let searchFrom = startFrom;
  while (true) {
    const idx = findLineIndex(lines, searchFrom, /^Entities$/i);
    if (idx < 0) break;
    entityIndices.push(idx);
    searchFrom = idx + 1;
  }

  for (const eIdx of entityIndices) {
    // Look at the next few non-blank lines to disambiguate
    const nextLines = getNonBlankLines(lines, eIdx + 1, 10);
    const hasDirectors = nextLines.some((l) => /directors\/trustees/i.test(l));
    const hasAmount = nextLines.some((l) => /^Amount$/i.test(l.trim()));

    if (hasDirectors && !sections.entityStructure) {
      const end = findNextLandmark(lines, eIdx + 1);
      sections.entityStructure = lines.slice(eIdx, end).join('\n');
    } else if (hasAmount && !sections.entityHoldings) {
      const end = findNextLandmark(lines, eIdx + 1);
      sections.entityHoldings = lines.slice(eIdx, end).join('\n');
    }
  }

  // Regular expenses
  const expIdx = findLineIndex(lines, startFrom, /^Regular expenses$/i);
  if (expIdx >= 0) {
    const end = findNextLandmark(lines, expIdx + 1);
    sections.regularExpenses = lines.slice(expIdx, end).join('\n');
  }

  // Lifestyle assets
  const lifIdx = findLineIndex(lines, startFrom, /^Lifestyle assets$/i);
  if (lifIdx >= 0) {
    const end = findNextLandmark(lines, lifIdx + 1);
    sections.lifestyleAssets = lines.slice(lifIdx, end).join('\n');
  }

  // Bank accounts
  const bankIdx = findLineIndex(lines, startFrom, /^Bank accounts$/i);
  if (bankIdx >= 0) {
    const end = findNextLandmark(lines, bankIdx + 1);
    sections.bankAccounts = lines.slice(bankIdx, end).join('\n');
  }

  // Life Insurance, TPD, Trauma and Income Protection
  const insIdx = findLineIndex(lines, startFrom, /^Life Insurance,?\s*TPD/i);
  if (insIdx >= 0) {
    const end = findNextLandmark(lines, insIdx + 1);
    sections.insurance = lines.slice(insIdx, end).join('\n');
  }

  // Financial investments
  const finIdx = findLineIndex(lines, startFrom, /^Financial investments$/i);
  if (finIdx >= 0) {
    const end = findNextLandmark(lines, finIdx + 1);
    sections.financialInvestments = lines.slice(finIdx, end).join('\n');
  }

  // Investment property
  const ipIdx = findLineIndex(lines, startFrom, /^Investment property$/i);
  if (ipIdx >= 0) {
    const end = findNextLandmark(lines, ipIdx + 1);
    sections.investmentProperty = lines.slice(ipIdx, end).join('\n');
  }

  // Superannuation — disambiguate: find the one with "Description" sub-header
  // (not the one that appears as a goals sub-category header)
  {
    let searchSuper = startFrom;
    while (true) {
      const idx = findLineIndex(lines, searchSuper, /^Superannuation$/i);
      if (idx < 0) break;
      const nextLines = getNonBlankLines(lines, idx + 1, 5);
      if (nextLines.some((l) => /^Description$/i.test(l.trim()) || /no information recorded/i.test(l))) {
        const end = findNextLandmark(lines, idx + 1, [/^Superannuation$/i]);
        sections.superannuation = lines.slice(idx, end).join('\n');
        break;
      }
      searchSuper = idx + 1;
    }
  }

  // Pension — disambiguate: find the one with "Description" sub-header
  {
    let searchPension = startFrom;
    while (true) {
      const idx = findLineIndex(lines, searchPension, /^Pension$/i);
      if (idx < 0) break;
      const nextLines = getNonBlankLines(lines, idx + 1, 5);
      if (nextLines.some((l) => /^Description$/i.test(l.trim()) || /no information recorded/i.test(l))) {
        // Skip own pattern — data rows named "Pension" shouldn't end the section
        const end = findNextLandmark(lines, idx + 1, [/^Pension$/i]);
        sections.pension = lines.slice(idx, end).join('\n');
        break;
      }
      searchPension = idx + 1;
    }
  }

  // Shares
  const sharesIdx = findLineIndex(lines, startFrom, /^Shares$/i);
  if (sharesIdx >= 0) {
    const end = findNextLandmark(lines, sharesIdx + 1);
    sections.shares = lines.slice(sharesIdx, end).join('\n');
  }

  // Loans
  const loansIdx = findLineIndex(lines, startFrom, /^Loans$/i);
  if (loansIdx >= 0) {
    const end = findNextLandmark(lines, loansIdx + 1);
    sections.loans = lines.slice(loansIdx, end).join('\n');
  }

  // Estate Planning — find the one with "Superannuation/pension fund" sub-header
  // (not the one that appears as a category header in the goals section)
  {
    let searchEstate = startFrom;
    while (true) {
      const idx = findLineIndex(lines, searchEstate, /^Estate Planning$/i);
      if (idx < 0) break;
      const nextLines = getNonBlankLines(lines, idx + 1, 5);
      if (nextLines.some((l) => /superannuation\/pension/i.test(l) || /no information recorded/i.test(l))) {
        const end = findNextLandmark(lines, idx + 1);
        sections.estatePlanning = lines.slice(idx, end).join('\n');
        break;
      }
      searchEstate = idx + 1;
    }
  }

  // Wills, EPA, EPG
  const willsIdx = findLineIndex(lines, startFrom, /^Wills, EPA, EPG$/i);
  if (willsIdx >= 0) {
    const end = findNextLandmark(lines, willsIdx + 1);
    sections.willsEpaEpg = lines.slice(willsIdx, end).join('\n');
  }

  // Risk Profile Summary
  const riskIdx = findLineIndex(lines, startFrom, /^RISK PROFILE SUMMARY/i);
  if (riskIdx >= 0) {
    const end = findLineIndex(lines, riskIdx + 1, STOP_PATTERN);
    sections.riskProfile = lines.slice(riskIdx, end >= 0 ? end : lines.length).join('\n');
  }

  return sections;
}

/** Find the index of a line matching pattern, starting from `from` */
function findLineIndex(lines: string[], from: number, pattern: RegExp): number {
  for (let i = from; i < lines.length; i++) {
    if (pattern.test(lines[i].trim())) return i;
  }
  return -1;
}

/** Get the next N non-blank lines starting from idx */
function getNonBlankLines(lines: string[], from: number, count: number): string[] {
  const result: string[] = [];
  for (let i = from; i < lines.length && result.length < count; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) result.push(trimmed);
  }
  return result;
}

/** All section header patterns — used for finding "next section" boundaries */
const SECTION_PATTERNS: RegExp[] = [
  /^Personal details$/i,
  /^Financial dependants$/i,
  /^Adult Children$/i,
  /^Relationships$/i,
  /^Goals and objectives$/i,
  /^Financial position$/i,
  /^Your income$/i,
  /^Entities$/i,
  /^Regular expenses$/i,
  /^Lifestyle assets$/i,
  /^Bank accounts$/i,
  /^Life Insurance,?\s*TPD/i,
  /^Financial investments$/i,
  /^Investment property$/i,
  /^Superannuation$/i,
  /^Pension$/i,
  /^Shares$/i,
  /^Loans$/i,
  /^Estate Planning$/i,
  /^Wills, EPA, EPG$/i,
  /^RISK PROFILE SUMMARY/i,
  STOP_PATTERN,
];

/** Find the next section header line index after `from`.
 *  Optional skipPatterns: patterns to ignore (e.g., current section's own header
 *  to avoid collisions with data rows that share the same name). */
function findNextLandmark(lines: string[], from: number, skipPatterns?: RegExp[]): number {
  for (let i = from; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    for (const pattern of SECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Skip patterns that match the current section's own header
        if (skipPatterns?.some((sp) => sp.test(trimmed))) continue;
        return i;
      }
    }
  }
  return lines.length;
}
