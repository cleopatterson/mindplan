import type { FinancialPlan } from 'shared/types';

export interface ScrubResult {
  text: string;
  surnames: string[];
}

/**
 * Scrubs sensitive identifiers from raw document text BEFORE sending to the Claude API.
 *
 * Scrubbed:  Surnames, ABNs/ACNs, dates of birth
 * Kept:      First names, ages, dollar amounts, entity types, asset/liability details
 */
export function scrubSensitiveData(text: string): ScrubResult {
  let scrubbed = text;

  // ── 1. Detect and replace client surnames ──
  const surnames = detectSurnames(text);
  for (let i = 0; i < surnames.length; i++) {
    scrubbed = scrubbed.replace(
      new RegExp(`\\b${escapeRegex(surnames[i])}\\b`, 'g'),
      `__SN${i}__`,
    );
  }

  // ── 2. ABNs / ACNs (11-digit business numbers) ──
  scrubbed = scrubbed.replace(
    /\b(ABN|ACN)[:\s]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/gi,
    '$1: [REDACTED]',
  );

  // ── 3. Dates of birth ──
  // Extract DOB dates, calculate age, then replace with "[DOB redacted, age NN]"
  // so Claude can set client.age without seeing the actual date.
  const knownDobs: { raw: string; age: number | null }[] = [];
  const dobLabelRe = /\b(?:Date\s+of\s+birth|DOB|Born)[:\s]+(.+)/gi;
  let dobLabelMatch: RegExpExecArray | null;
  while ((dobLabelMatch = dobLabelRe.exec(scrubbed)) !== null) {
    const rest = dobLabelMatch[1];
    for (const m of rest.matchAll(/\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi)) {
      knownDobs.push({ raw: m[0], age: ageFromDob(m[0]) });
    }
    for (const m of rest.matchAll(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g)) {
      knownDobs.push({ raw: m[0], age: ageFromDob(m[0]) });
    }
  }

  // Step B: Replace ALL occurrences of known DOB dates throughout the text
  for (const dob of knownDobs) {
    const replacement = dob.age !== null ? `[DOB redacted, age ${dob.age}]` : '[DOB redacted]';
    scrubbed = scrubbed.replaceAll(dob.raw, replacement);
  }

  // Step C: Redact any remaining labeled DOB lines (edge cases)
  scrubbed = scrubbed.replace(
    /\b(Date\s+of\s+birth|DOB|Born)[:\s]+(.+)/gi,
    (_match, label: string, rest: string) => {
      const redacted = rest.replace(
        /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
        (m) => { const a = ageFromDob(m); return a !== null ? `[DOB redacted, age ${a}]` : '[DOB redacted]'; },
      ).replace(
        /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
        (m) => { const a = ageFromDob(m); return a !== null ? `[DOB redacted, age ${a}]` : '[DOB redacted]'; },
      );
      return `${label}: ${redacted}`;
    },
  );

  // Step D: Catch shorthand DOB labels
  scrubbed = scrubbed.replace(
    /\b(d\.?o\.?b\.?)\s*[:\s]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    (_m, label: string, date: string) => {
      const a = ageFromDob(date);
      return a !== null ? `${label}: [DOB redacted, age ${a}]` : `${label}: [DOB redacted]`;
    },
  );

  // ── Logging ──
  const redactedCount = (scrubbed.match(/\[REDACTED\]|\[DOB redacted\]/g) || []).length;
  const surnameCount = (scrubbed.match(/__SN\d+__/g) || []).length;
  console.log(
    `⏱ [scrub] Detected surnames: [${surnames.join(', ')}] | ` +
    `${surnameCount} surname replacements, ${redactedCount} other redactions`,
  );

  return { text: scrubbed, surnames };
}

/**
 * After Claude returns structured data, restore surname placeholders back to real surnames.
 * This runs BEFORE anonymize(), which then strips surnames from person-name fields only.
 * Entity names, asset names, liability names retain the real surnames.
 */
export function restoreSurnames(plan: FinancialPlan, surnames: string[]): void {
  if (surnames.length === 0) return;

  const restore = (s: string): string => {
    let result = s;
    for (let i = 0; i < surnames.length; i++) {
      result = result.replaceAll(`__SN${i}__`, surnames[i]);
    }
    return result;
  };

  for (const c of plan.clients) c.name = restore(c.name);

  for (const e of plan.entities) {
    e.name = restore(e.name);
    if (e.trusteeName) e.trusteeName = restore(e.trusteeName);
  }

  for (const m of plan.familyMembers ?? []) {
    m.name = restore(m.name);
    if (m.partner) m.partner = restore(m.partner);
    for (const child of m.children ?? []) child.name = restore(child.name);
  }

  for (const item of plan.estatePlanning ?? []) {
    if (item.primaryPerson) item.primaryPerson = restore(item.primaryPerson);
    if (item.alternatePeople) item.alternatePeople = item.alternatePeople.map(restore);
  }

  for (const a of plan.personalAssets) a.name = restore(a.name);
  for (const l of plan.personalLiabilities) l.name = restore(l.name);
  for (const e of plan.entities) {
    for (const a of e.assets) a.name = restore(a.name);
    for (const l of e.liabilities) l.name = restore(l.name);
  }

  for (const g of plan.dataGaps) g.description = restore(g.description);
}

// ── Surname detection ──

function detectSurnames(text: string): string[] {
  const surnames: string[] = [];

  // Pattern 1: "For: Name & Name Surname" or "For: Name Surname & Name Surname"
  // [^\S\n]+ = horizontal whitespace (space/tab) — prevents names crossing newlines
  const forPatterns = [
    /(?:For|Prepared\s+for)[:\s]+([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)[^\S\n]*(?:&|and)[^\S\n]*([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)/i,
    /FINANCIAL\s+PLAN\s*[—–\-]\s*([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)[^\S\n]*(?:&|and)[^\S\n]*([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)/i,
  ];

  for (const pattern of forPatterns) {
    const match = text.match(pattern);
    if (match) {
      addSurname(match[1], surnames);
      addSurname(match[2], surnames);
      if (surnames.length > 0) break;
    }
  }

  // Pattern 2: Multiline "Prepared for\nFirstName Surname and FirstName Surname"
  if (surnames.length === 0) {
    const ml = text.match(
      /Prepared\s+for\s*\n[^\S\n]*([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)[^\S\n]+(?:and|&)[^\S\n]+([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)*)/i,
    );
    if (ml) {
      addSurname(ml[1], surnames);
      addSurname(ml[2], surnames);
    }
  }

  // Pattern 3: "Full name" table row (fact-find / questionnaire style)
  if (surnames.length === 0) {
    const fn = text.match(/Full\s+name[^\S\n]+([A-Z][a-z]+(?:[^\S\n]+[A-Z][a-z]+)+)/i);
    if (fn) addSurname(fn[1], surnames);
  }

  // Pattern 4: Single client "Prepared for: FirstName Surname"
  if (surnames.length === 0) {
    const single = text.match(
      /(?:For|Prepared\s+for|Client)[:\s]+([A-Z][a-z]+[^\S\n]+[A-Z][a-z]+)[^\S\n]*$/im,
    );
    if (single) addSurname(single[1], surnames);
  }

  return [...new Set(surnames)];
}

function addSurname(fullName: string, surnames: string[]): void {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1) {
    const surname = parts[parts.length - 1];
    const ignore = new Set(['and', '&', 'the', 'for', 'of', 'pty', 'ltd']);
    if (!ignore.has(surname.toLowerCase()) && !surnames.includes(surname)) {
      surnames.push(surname);
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse a date string and return age in years, or null if unparseable */
function ageFromDob(dateStr: string): number | null {
  const now = new Date();

  // Try "DD Month YYYY" (e.g. "25 July 1969")
  const longMatch = dateStr.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (longMatch) {
    const dob = new Date(`${longMatch[2]} ${longMatch[1]}, ${longMatch[3]}`);
    if (!isNaN(dob.getTime())) return yearsDiff(dob, now);
  }

  // Try "DD/MM/YYYY" or "DD-MM-YYYY"
  const shortMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (shortMatch) {
    const day = parseInt(shortMatch[1], 10);
    const month = parseInt(shortMatch[2], 10) - 1;
    let year = parseInt(shortMatch[3], 10);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    const dob = new Date(year, month, day);
    if (!isNaN(dob.getTime())) return yearsDiff(dob, now);
  }

  return null;
}

function yearsDiff(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
