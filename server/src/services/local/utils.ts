/**
 * Shared utilities for the local code-based parser.
 */

/** Parse "$1,234,567" or "-$1,234,567" → number | null */
export function parseDollar(s: string | undefined | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[,$\s]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.abs(n);
}

/** Parse age from string, e.g. "74" → 74 */
export function parseAge(s: string | undefined | null): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return isNaN(n) || n < 0 || n > 150 ? null : n;
}

/** Normalize name: trim, collapse whitespace */
export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Extract first name from full name */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

/**
 * Resolve owner string to client IDs.
 * Handles: "Dorothy", "Miles & Nerine", "Miles and Nerine", "Rudolf & Annette"
 * Returns all client IDs if owner can't be resolved.
 */
export function resolveOwnerIds(
  ownerStr: string | undefined | null,
  clients: { id: string; name: string }[],
): string[] {
  if (!ownerStr || !ownerStr.trim()) return clients.map((c) => c.id);

  const owner = ownerStr.trim();

  // Joint ownership: split on " & " or " and "
  const parts = owner.split(/\s*[&]\s*|\s+and\s+/i).map((p) => p.trim()).filter(Boolean);

  const ids: string[] = [];
  for (const part of parts) {
    const match = clients.find(
      (c) =>
        c.name.toLowerCase() === part.toLowerCase() ||
        firstName(c.name).toLowerCase() === part.toLowerCase(),
    );
    if (match) {
      ids.push(match.id);
    }
  }

  // If we couldn't resolve any, default to all clients
  return ids.length > 0 ? ids : clients.map((c) => c.id);
}

/**
 * Split concatenated names like "DorothyDaniel/Sonia/Karl" or "MilesNerine"
 * into individual names, using known names for CamelCase boundary detection.
 */
export function splitConcatenatedNames(
  raw: string,
  knownFirstNames: string[],
): string[] {
  if (!raw || !raw.trim()) return [];

  // First split on "/" delimiter
  const slashParts = raw.split('/').map((s) => s.trim()).filter(Boolean);

  const result: string[] = [];
  for (const part of slashParts) {
    // Try to split CamelCase using known names
    const split = splitCamelCaseWithNames(part, knownFirstNames);
    result.push(...split);
  }

  return result;
}

function splitCamelCaseWithNames(text: string, knownNames: string[]): string[] {
  if (!text) return [];

  // Sort known names by length desc so longer matches are tried first
  const sorted = [...knownNames].sort((a, b) => b.length - a.length);
  const results: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let matched = false;
    for (const name of sorted) {
      if (remaining.startsWith(name)) {
        results.push(name);
        remaining = remaining.slice(name.length);
        // Skip any whitespace
        remaining = remaining.replace(/^\s+/, '');
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Try to detect CamelCase boundary (lowercase→uppercase)
      const camelMatch = remaining.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (camelMatch) {
        results.push(camelMatch[1]);
        remaining = remaining.slice(camelMatch[1].length);
        remaining = remaining.replace(/^\s+/, '');
      } else {
        // Give up — push whatever is left
        results.push(remaining.trim());
        break;
      }
    }
  }

  return results.filter(Boolean);
}

/** Check if a line is "No information recorded." or similar empty indicator */
export function isNoInfoLine(line: string): boolean {
  return /no information recorded/i.test(line.trim());
}
