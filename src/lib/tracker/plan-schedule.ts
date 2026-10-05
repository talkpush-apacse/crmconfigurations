import { addDays } from "./dates";
import type { ItemVisibility, PersonSide, PlanAudience } from "./constants";

/**
 * Pure rules for turning a standard plan into project dates, visibility and owners.
 * No database access here, so every rule can be tested on its own.
 *
 * Timing is stored on plan items as 1-based WORKING days (Monday to Friday) counted
 * from the project start date. Week N is working days 5(N-1)+1 to 5N. Working days
 * (rather than whole weeks) let the two-week Configuration window be sequenced
 * properly: a dependent item may start the same day its blocker is due.
 */

export const WORKDAYS_PER_WEEK = 5;

function isWeekend(date: string): boolean {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** The start date itself, or the next Monday when it falls on a weekend. */
export function firstWorkday(date: string): string {
  let d = date;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/** The calendar date of working day `day` (1 = the first working day on or after `projectStart`). */
export function workdayDate(projectStart: string, day: number): string {
  let d = firstWorkday(projectStart);
  let remaining = Math.max(1, Math.floor(day)) - 1;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) remaining -= 1;
  }
  return d;
}

/** Start and due dates for an item. Null dates when the project has no start date or the item has no timing. */
export function planDates(
  projectStart: string | null | undefined,
  startDay: number | null | undefined,
  endDay: number | null | undefined
): { startDate: string | null; dueDate: string | null } {
  if (!projectStart) return { startDate: null, dueDate: null };
  const start = startDay ?? endDay;
  const end = endDay ?? startDay;
  if (start === null || start === undefined || end === null || end === undefined) {
    return { startDate: null, dueDate: null };
  }
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  return { startDate: workdayDate(projectStart, first), dueDate: workdayDate(projectStart, last) };
}

/** The dates a phase covers, from its week range (for example [3, 4] = Configuration). */
export function phaseDates(
  projectStart: string | null | undefined,
  weeks: readonly [number, number] | null | undefined
): { startDate: string | null; endDate: string | null } {
  if (!projectStart || !weeks) return { startDate: null, endDate: null };
  const [fromWeek, toWeek] = weeks;
  return {
    startDate: workdayDate(projectStart, WORKDAYS_PER_WEEK * (fromWeek - 1) + 1),
    endDate: workdayDate(projectStart, WORKDAYS_PER_WEEK * toWeek),
  };
}

/** Which week (1-based) a working day falls in, for display ("Week 3"). */
export function weekOfDay(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / WORKDAYS_PER_WEEK) + 1;
}

/** "Week 3", "Weeks 3 to 4", "Day 6 to 10 (week 2)" style label for a timing window. */
export function describeTiming(startDay: number | null, endDay: number | null): string {
  const start = startDay ?? endDay;
  const end = endDay ?? startDay;
  if (start === null || end === null) return "No timing set";
  const w1 = weekOfDay(start);
  const w2 = weekOfDay(end);
  return w1 === w2 ? `Week ${w1}` : `Weeks ${w1} to ${w2}`;
}

/** What an audience means for a project item. */
export function audienceFields(audience: PlanAudience): { visibility: ItemVisibility; ownerSide: PersonSide } {
  switch (audience) {
    case "internal":
      return { visibility: "internal", ownerSide: "talkpush" };
    case "client":
      return { visibility: "client_visible", ownerSide: "client" };
    default:
      return { visibility: "client_visible", ownerSide: "talkpush" };
  }
}

/**
 * Who owns a new item. Talkpush-side items go to the project owner (when set).
 * Client-side items stay unassigned: Talkpush does not know the client's people yet.
 */
export function defaultOwnerPersonId(audience: PlanAudience, projectOwnerPersonId: string | null | undefined): string | null {
  return audienceFields(audience).ownerSide === "talkpush" ? projectOwnerPersonId ?? null : null;
}
