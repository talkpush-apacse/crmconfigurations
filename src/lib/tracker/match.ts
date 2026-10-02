/**
 * Resolve a human-typed name ("UAT sign-off", "ana") to exactly one record.
 * Used by the MCP tools so Claude can say "mark UAT sign-off as done" without
 * knowing database ids. Exact (case-insensitive) match wins; otherwise a single
 * "contains" match is accepted; anything else is reported with the candidates
 * so the caller can disambiguate instead of guessing.
 */

export type MatchResult<T> =
  | { kind: "one"; value: T }
  | { kind: "none" }
  | { kind: "many"; candidates: T[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function matchByName<T>(candidates: readonly T[], query: string, getName: (item: T) => string): MatchResult<T> {
  const q = norm(query);
  if (!q) return { kind: "none" };
  const exact = candidates.filter((c) => norm(getName(c)) === q);
  if (exact.length === 1) return { kind: "one", value: exact[0] };
  if (exact.length > 1) return { kind: "many", candidates: exact };
  const partial = candidates.filter((c) => norm(getName(c)).includes(q));
  if (partial.length === 1) return { kind: "one", value: partial[0] };
  if (partial.length > 1) return { kind: "many", candidates: partial };
  return { kind: "none" };
}
