/**
 * Parse "RISK PROFILE SUMMARY" section.
 * Format: "Investment Profile for {Name}" followed by description text
 * containing risk profile keywords.
 */
import type { RiskProfile } from 'shared/types';

export interface RiskProfileItem {
  name: string;          // person/entity name
  profile: RiskProfile;
}

export function parseRiskProfiles(text: string | null): RiskProfileItem[] {
  if (!text) return [];

  const items: RiskProfileItem[] = [];

  // Split on "Investment Profile for" headers
  const pattern = /Investment Profile for\s+(.+)/gi;
  let match;
  const profiles: { name: string; startIdx: number }[] = [];

  while ((match = pattern.exec(text)) !== null) {
    profiles.push({ name: match[1].trim(), startIdx: match.index });
  }

  for (let i = 0; i < profiles.length; i++) {
    const start = profiles[i].startIdx;
    const end = i + 1 < profiles.length ? profiles[i + 1].startIdx : text.length;
    const block = text.slice(start, end);

    const profile = inferRiskProfile(block);
    if (profile) {
      items.push({ name: profiles[i].name, profile });
    }
  }

  return items;
}

function inferRiskProfile(text: string): RiskProfile | null {
  const lower = text.toLowerCase();

  // Check for specific profile names in quoted text like 'SMA - Growth'
  const quotedMatch = text.match(/'([^']+)'/);
  if (quotedMatch) {
    const profileName = quotedMatch[1].toLowerCase();
    if (/high\s*growth/i.test(profileName)) return 'high_growth';
    if (/growth/i.test(profileName)) return 'growth';
    if (/balanced/i.test(profileName)) return 'balanced';
    if (/moderately\s*conservative/i.test(profileName)) return 'moderately_conservative';
    if (/conservative/i.test(profileName)) return 'conservative';
  }

  // Fallback to text analysis
  if (/high\s*growth/i.test(lower)) return 'high_growth';
  if (/80\.?0?\s*percent\s*(exposure\s*to\s*)?growth/i.test(lower)) return 'growth';
  if (/70\.?0?\s*percent.*growth/i.test(lower)) return 'growth';
  if (/50\.?0?\s*percent.*growth/i.test(lower)) return 'balanced';
  if (/30\.?0?\s*percent.*growth/i.test(lower)) return 'moderately_conservative';
  if (/conservative/i.test(lower)) return 'conservative';
  if (/growth/i.test(lower)) return 'growth';
  if (/balanced/i.test(lower)) return 'balanced';

  return null;
}
