/** What the gallery shows for one company, and how the list is searched and sorted. Pure: no database, no screen. */

export interface CompanyAttention {
  openComments: number;
  pendingSuggestions: number;
  openRequests: number;
}

export interface CompanyCardData {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
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

export function filterCompanies(list: CompanyCardData[], query: string): CompanyCardData[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
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
