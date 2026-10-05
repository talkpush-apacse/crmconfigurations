/** Name matching for the plan. Close names are shown side by side for a person to decide; they are never merged. */

export function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Lowercase, no punctuation, single spaces: "Interview Scheduled!" and "interview  scheduled" are the same name. */
export function normalizeName(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Are two DIFFERENT normalized names close enough to be worth a look? */
export function looksLikeSameThing(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  const distance = levenshtein(a, b);
  return distance / Math.max(a.length, b.length) <= 0.25;
}
