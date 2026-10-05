import { addDays, daysBetween } from "./dates";

/**
 * Planned vs actual progress, from the items themselves.
 *  - planned: how many items were due on or before each date
 *  - actual:  how many items had been completed on or before each date
 * Both lines count whole items and start at zero, so the chart is honest about scale.
 */

export interface BurnupItem {
  status: string;
  archived: boolean;
  dueDate: string | null;
  completedAt: string | null; // ISO timestamp or YYYY-MM-DD
}

export interface BurnupPoint {
  date: string;
  planned: number;
  /** Null for dates in the future. */
  actual: number | null;
}

export interface Burnup {
  points: BurnupPoint[];
  /** Items that count toward progress (not dropped, not archived). */
  total: number;
  /** Items with no due date, so they are not on the plan line. */
  unplanned: number;
  plannedToday: number;
  actualToday: number;
  /** Positive = behind plan, negative = ahead. */
  behindBy: number;
  start: string;
  end: string;
}

const day = (v: string) => v.slice(0, 10);

export function buildBurnup(
  items: readonly BurnupItem[],
  range: { startDate: string | null; targetDate: string | null },
  today: string
): Burnup | null {
  const live = items.filter((i) => !i.archived && i.status !== "dropped");
  if (live.length === 0) return null;

  const dues = live.map((i) => i.dueDate).filter((d): d is string => !!d);
  const dones = live.filter((i) => i.status === "done" && i.completedAt).map((i) => day(i.completedAt as string));
  const dates = [...dues, ...dones];
  if (dates.length === 0) return null;

  const start = [range.startDate, ...dates].filter((d): d is string => !!d).sort()[0];
  const end = [range.targetDate, today, ...dates].filter((d): d is string => !!d).sort().slice(-1)[0];
  if (start >= end) return null;

  const plannedBy = (d: string) => dues.filter((x) => x <= d).length;
  const actualBy = (d: string) => live.filter((i) => i.status === "done" && (!i.completedAt || day(i.completedAt) <= d)).length;

  // About 12 to 14 points, stepping in whole weeks so the x axis reads cleanly.
  const span = daysBetween(start, end);
  const step = Math.max(7, Math.ceil(span / 12 / 7) * 7);
  const dateList: string[] = [];
  for (let d = start; d < end; d = addDays(d, step)) dateList.push(d);
  dateList.push(end);
  if (today > start && today < end && !dateList.includes(today)) dateList.push(today);
  dateList.sort();

  const points: BurnupPoint[] = dateList.map((date) => ({
    date,
    planned: plannedBy(date),
    actual: date <= today ? actualBy(date) : null,
  }));

  const plannedToday = plannedBy(today);
  const actualToday = actualBy(today);
  return {
    points,
    total: live.length,
    unplanned: live.length - dues.length,
    plannedToday,
    actualToday,
    behindBy: plannedToday - actualToday,
    start,
    end,
  };
}

/** The sentence that goes under the chart. States the finding, with the numbers. */
/** `withUnplanned: false` leaves out the "no due date" housekeeping sentence, for the client face. */
export function burnupInsight(b: Burnup, opts: { withUnplanned?: boolean } = {}): string {
  const parts: string[] = [];
  if (b.behindBy > 0) parts.push(`${b.actualToday} items are done against ${b.plannedToday} planned by today, so the project is ${b.behindBy} ${b.behindBy === 1 ? "item" : "items"} behind plan.`);
  else if (b.behindBy < 0) parts.push(`${b.actualToday} items are done against ${b.plannedToday} planned by today, so the project is ${-b.behindBy} ${-b.behindBy === 1 ? "item" : "items"} ahead of plan.`);
  else parts.push(`${b.actualToday} items are done, exactly as planned by today.`);
  if (b.unplanned > 0 && opts.withUnplanned !== false) parts.push(`${b.unplanned} ${b.unplanned === 1 ? "item has" : "items have"} no due date and ${b.unplanned === 1 ? "is" : "are"} not on the plan line.`);
  return parts.join(" ");
}
