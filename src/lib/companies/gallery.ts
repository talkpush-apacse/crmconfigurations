/** What the gallery shows for one company, and how the list is searched and sorted. Pure: no database, no screen. */

export interface CompanyAttention {
  openComments: number;
  pendingSuggestions: number;
  openRequests: number;
}

export interface CompanyCardData {
  id: string;
  /** The account's name, for example "Concentrix PH". */
  name: string;
  slug: string;
  notes: string | null;
  /** The company this account belongs to ("Concentrix") and its geo, empty on accounts made before companies existed. */
  companyId: string | null;
  companyName: string | null;
  geo: string | null;
  geoCode: string | null;
  checklistCount: number;
  workflowCount: number;
  projectCount: number;
  attention: CompanyAttention;
  /** ISO time of the most recent change to the company or anything filed under it. */
  lastActivityAt: string;
}

export type GallerySort = "recent" | "name" | "attention";

export const SORT_LABELS: Record<GallerySort, string> = {
  recent: "Recent activity",
  name: "Name (A to Z)",
  attention: "Needs attention",
};

export const attentionTotal = (a: CompanyAttention) => a.openComments + a.pendingSuggestions + a.openRequests;

/** Search matches the account's name, its company, or its geo (name or code). */
export function filterCompanies(list: CompanyCardData[], query: string): CompanyCardData[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => [c.name, c.companyName, c.geo, c.geoCode].some((t) => (t ?? "").toLowerCase().includes(q)));
}

export type GalleryUnit =
  | { kind: "account"; card: CompanyCardData }
  | { kind: "company"; companyId: string; name: string; cards: CompanyCardData[] };

/**
 * Accounts of the same company sit together under the company's name when it has more than one in view; an account on its
 * own is just a card. Units keep the order the list was sorted in (a company sits where its first account would).
 */
export function arrangeGallery(sorted: CompanyCardData[]): GalleryUnit[] {
  const perCompany = new Map<string, CompanyCardData[]>();
  for (const c of sorted) if (c.companyId) perCompany.set(c.companyId, [...(perCompany.get(c.companyId) ?? []), c]);
  const units: GalleryUnit[] = [];
  const placed = new Set<string>();
  for (const c of sorted) {
    const group = c.companyId ? perCompany.get(c.companyId) : undefined;
    if (!c.companyId || !group || group.length < 2) {
      units.push({ kind: "account", card: c });
    } else if (!placed.has(c.companyId)) {
      placed.add(c.companyId);
      units.push({ kind: "company", companyId: c.companyId, name: c.companyName ?? c.name, cards: group });
    }
  }
  return units;
}

export function sortCompanies(list: CompanyCardData[], sort: GallerySort): CompanyCardData[] {
  const byName = (a: CompanyCardData, b: CompanyCardData) => a.name.localeCompare(b.name);
  const copy = [...list];
  if (sort === "name") return copy.sort(byName);
  if (sort === "attention") return copy.sort((a, b) => attentionTotal(b.attention) - attentionTotal(a.attention) || byName(a, b));
  return copy.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime() || byName(a, b));
}

const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 open comments, 1 access request": what is waiting, in words. Empty when nothing is. */
export function describeAttention(a: CompanyAttention): string {
  return [
    a.openComments ? noun(a.openComments, "open comment", "open comments") : "",
    a.pendingSuggestions ? noun(a.pendingSuggestions, "suggestion waiting", "suggestions waiting") : "",
    a.openRequests ? noun(a.openRequests, "access request", "access requests") : "",
  ].filter(Boolean).join(", ");
}
