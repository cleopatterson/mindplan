import type { FinancialPlan } from 'shared/types';

/**
 * Strips client surnames from person-name fields only
 * so the rendered mind map shows first names (e.g. "Jim" instead of "Jim Wall").
 * Entity, asset, and liability names are left untouched.
 */
export function anonymize(plan: FinancialPlan): void {
  // Collect surnames from clients (last word of each full name)
  const surnameMap = new Map<string, string>(); // full name → first name(s)
  const surnames = new Set<string>();

  for (const client of plan.clients) {
    const parts = client.name.trim().split(/\s+/);
    if (parts.length > 1) {
      surnames.add(parts[parts.length - 1]);
      surnameMap.set(client.name, parts.slice(0, -1).join(' '));
    }
  }

  if (surnames.size === 0) return; // nothing to strip

  // Helper: remove the trailing surname if it's a known one
  const stripSurname = (name: string): string => {
    if (surnameMap.has(name)) return surnameMap.get(name)!;
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1 && surnames.has(parts[parts.length - 1])) {
      return parts.slice(0, -1).join(' ');
    }
    return name;
  };

  // Anonymize person-name fields only
  for (const client of plan.clients) {
    client.name = stripSurname(client.name);
  }

  for (const member of plan.familyMembers ?? []) {
    member.name = stripSurname(member.name);
    if (member.partner) member.partner = stripSurname(member.partner);
    for (const child of member.children ?? []) {
      child.name = stripSurname(child.name);
    }
  }

  // Estate planning contacts (person names, not entity names)
  for (const item of plan.estatePlanning ?? []) {
    if (item.primaryPerson) item.primaryPerson = stripSurname(item.primaryPerson);
    if (item.alternatePeople) {
      item.alternatePeople = item.alternatePeople.map(stripSurname);
    }
  }

  // Individual trustee names (skip corporate trustees)
  for (const entity of plan.entities) {
    if (entity.trusteeName && entity.trusteeType !== 'corporate') {
      entity.trusteeName = stripSurname(entity.trusteeName);
    }
  }
}
