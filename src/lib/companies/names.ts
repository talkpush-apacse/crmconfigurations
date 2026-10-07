/**
 * Company names as people type them are never quite the same twice: "McDonald's PH", "mcdonalds ph", "Acme, Inc.".
 * These pure helpers decide when two names are probably the same company. A match is only ever shown as a
 * suggestion for staff to accept; nothing is ever filed under a company because of a name match alone.
 */

const CORPORATE_WORDS = new Set(["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company"]);

/** "McDonald's PH" and "mcdonalds ph" become the same key; "Acme, Inc." becomes "acme". */
export function nameKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !CORPORATE_WORDS.has(w));
  return (kept.length > 0 ? kept : words).join(" ");
}

export function sameCompanyName(a: string, b: string): boolean {
  const ka = nameKey(a);
  return ka.length > 0 && ka === nameKey(b);
}

export interface NamedAccount {
  id: string;
  name: string;
}

/** The company whose name matches, if exactly one does. Two matches means we cannot tell, so we suggest nothing. */
export function suggestAccount(clientName: string, accounts: NamedAccount[]): NamedAccount | null {
  const hits = accounts.filter((a) => sameCompanyName(a.name, clientName));
  return hits.length === 1 ? hits[0] : null;
}
