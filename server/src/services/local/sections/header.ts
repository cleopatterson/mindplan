/**
 * Parse the header section: "Prepared for" names, adviser, licensee.
 */
import { normalizeName } from '../utils.js';

export interface HeaderInfo {
  clientNames: string[];   // e.g. ["Dorothy Smith"] or ["Miles Ashton", "Nerine Ashton"]
  adviser: string | null;
  licensee: string | null;
}

export function parseHeader(text: string): HeaderInfo {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let clientNames: string[] = [];
  let adviser: string | null = null;
  let licensee: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (/^Prepared for$/i.test(lines[i]) && i + 1 < lines.length) {
      const namesLine = lines[i + 1];
      // Split on " and " for dual clients
      clientNames = namesLine.split(/\s+and\s+/i).map((n) => normalizeName(n));
    }
    if (/^Prepared by$/i.test(lines[i]) && i + 1 < lines.length) {
      adviser = normalizeName(lines[i + 1]);
    }
    if (/^Licensee$/i.test(lines[i]) && i + 1 < lines.length) {
      licensee = normalizeName(lines[i + 1]);
    }
  }

  return { clientNames, adviser, licensee };
}
