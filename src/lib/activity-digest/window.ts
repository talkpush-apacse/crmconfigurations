/**
 * Which stretch of time does a daily digest cover? Pure, so the date maths is tested.
 *
 * The digest goes out Monday to Friday at 8:00 am Manila time. Manila is UTC+8 all year (no daylight saving), so
 * 8:00 am Manila is exactly 00:00 UTC on the same calendar date. A day's window runs from the previous weekday's
 * 8:00 am to this day's 8:00 am, so Monday looks back to Friday.
 *
 * The window is built from the SCHEDULED slot, never from the moment the job actually started. Vercel's free plan can
 * start a job up to an hour late, and a late start must not shift what the email covers.
 */

export interface SlotDate {
  year: number;
  month: number; // 1 to 12
  day: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_HOURS = 8;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The slot's 8:00 am Manila, as an exact moment. */
export function slotInstant(slot: SlotDate): Date {
  return new Date(Date.UTC(slot.year, slot.month - 1, slot.day, 0, 0, 0));
}

function dayOfWeek(slot: SlotDate): number {
  return new Date(Date.UTC(slot.year, slot.month - 1, slot.day)).getUTCDay();
}

function shiftDays(slot: SlotDate, days: number): SlotDate {
  const d = new Date(Date.UTC(slot.year, slot.month - 1, slot.day) + days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isWeekday(slot: SlotDate): boolean {
  const dow = dayOfWeek(slot);
  return dow >= 1 && dow <= 5;
}

export function slotToString(slot: SlotDate): string {
  return `${slot.year}-${String(slot.month).padStart(2, "0")}-${String(slot.day).padStart(2, "0")}`;
}

/** "2026-10-08" to a slot. Throws a plain-language error for a bad date or a weekend (no digest goes out then). */
export function parseSlotDate(value: string): SlotDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) throw new Error("Use a date like 2026-10-08.");
  const slot = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const check = new Date(Date.UTC(slot.year, slot.month - 1, slot.day));
  if (check.getUTCFullYear() !== slot.year || check.getUTCMonth() + 1 !== slot.month || check.getUTCDate() !== slot.day) {
    throw new Error("That date does not exist.");
  }
  if (!isWeekday(slot)) throw new Error("The digest only goes out Monday to Friday.");
  return slot;
}

/** The most recent weekday 8:00 am Manila at or before `now`: the slot a run at this moment is delivering. */
export function scheduledSlotFor(now: Date): SlotDate {
  const manila = new Date(now.getTime() + MANILA_OFFSET_HOURS * 60 * 60 * 1000);
  let slot: SlotDate = { year: manila.getUTCFullYear(), month: manila.getUTCMonth() + 1, day: manila.getUTCDate() };
  // Before 8:00 am Manila the day's slot has not happened yet.
  if (manila.getUTCHours() < 8) slot = shiftDays(slot, -1);
  while (!isWeekday(slot)) slot = shiftDays(slot, -1);
  return slot;
}

export function previousSlot(slot: SlotDate): SlotDate {
  let prev = shiftDays(slot, -1);
  while (!isWeekday(prev)) prev = shiftDays(prev, -1);
  return prev;
}

/** The changes this digest covers: from `start` (inclusive) up to `end` (exclusive). */
export function windowFor(slot: SlotDate): { start: Date; end: Date } {
  return { start: slotInstant(previousSlot(slot)), end: slotInstant(slot) };
}

/** "yesterday" Tuesday to Friday, "Friday" on a Monday. For the subject and headline. */
export function sinceWord(slot: SlotDate): string {
  return dayOfWeek(slot) === 1 ? WEEKDAYS[dayOfWeek(previousSlot(slot))] : "yesterday";
}

export const MAX_CATCH_UP_DAYS = 7;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Where does this digest's window start? Normally at the previous weekday's 8:00 am. If digests were missed, it starts
 * where the last one that really went out (or was skipped for a quiet day) ended, so nothing is lost, but never more than
 * MAX_CATCH_UP_DAYS back, so one long gap cannot produce an enormous email.
 */
export function windowStartFor(slot: SlotDate, lastCompletedEnd: Date | null): Date {
  const end = slotInstant(slot);
  const normal = slotInstant(previousSlot(slot));
  if (!lastCompletedEnd || lastCompletedEnd.getTime() >= normal.getTime()) return normal;
  const earliest = new Date(end.getTime() - MAX_CATCH_UP_DAYS * DAY_MS);
  return lastCompletedEnd.getTime() < earliest.getTime() ? earliest : lastCompletedEnd;
}

/** True when this window reaches further back than one normal day (a missed digest is being caught up). */
export function isCatchUp(slot: SlotDate, start: Date): boolean {
  return start.getTime() < slotInstant(previousSlot(slot)).getTime();
}

/** "yesterday" or "Friday" for a normal window; "Wednesday" or "2 Oct" when catching up. */
export function sinceLabel(slot: SlotDate, start: Date): string {
  if (!isCatchUp(slot, start)) return sinceWord(slot);
  const gapDays = Math.round((slotInstant(slot).getTime() - start.getTime()) / DAY_MS);
  if (gapDays <= 6) return WEEKDAYS[start.getUTCDay()];
  return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
}
