/**
 * Calendar-day helpers. Tracker dates are plain "YYYY-MM-DD" strings in the API
 * and @db.Date columns in the database, so a time zone can never move a due
 * date by a day. "Today" is the only time-zone-sensitive value; it uses
 * TRACKER_TIMEZONE (an IANA name such as "Asia/Manila"), defaulting to UTC.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "2026-11-14" -> Date at UTC midnight (what a Postgres date column expects). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (!isDateOnly(value)) throw new Error(`Invalid date: ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date from a date column -> "YYYY-MM-DD". */
export function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

/** Today's calendar date in the configured time zone. */
export function todayDateOnly(now: Date = new Date(), timeZone?: string): string {
  const tz = timeZone ?? process.env.TRACKER_TIMEZONE ?? "UTC";
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00.000Z`) - Date.parse(`${a}T00:00:00.000Z`);
  return Math.round(ms / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Days past due as of `today` (0 when not overdue or no due date). */
export function overdueDays(dueDate: string | null | undefined, today: string): number {
  if (!dueDate) return 0;
  const d = daysBetween(dueDate, today);
  return d > 0 ? d : 0;
}

/** "3 days overdue", "due today", "due in 4 days". Written out so colour is never the only cue. */
export function describeDue(dueDate: string | null | undefined, today: string): string | null {
  if (!dueDate) return null;
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return `${-diff} day${diff === -1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  return `Due in ${diff} day${diff === 1 ? "" : "s"}`;
}
