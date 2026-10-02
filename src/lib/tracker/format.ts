/** Display helpers that are safe to import in the browser. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" -> "14 Nov 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-14" -> "14 Nov" (same year as `today`) or "14 Nov 2027". */
export function formatShortDate(value: string | null | undefined, today: string): string {
  if (!value) return "No date";
  return value.slice(0, 4) === today.slice(0, 4) ? formatDate(value).replace(/ \d{4}$/, "") : formatDate(value);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
