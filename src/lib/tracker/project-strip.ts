/**
 * Numbers behind the compact strip under the project title: the progress bar and the date bar.
 * Pure functions, no React, no database.
 */
import { daysBetween, overdueDays } from "./dates";

export interface StatusCounts {
  done: number;
  in_progress: number;
  waiting_on_client: number;
  blocked: number;
  not_started: number;
}

/** Counts for the progress bar. Dropped and archived items are left out, the same as the Summary tab's totals. */
export function statusCounts(items: readonly { status: string; archived?: boolean }[]): StatusCounts {
  const counts: StatusCounts = { done: 0, in_progress: 0, waiting_on_client: 0, blocked: 0, not_started: 0 };
  for (const i of items) {
    if (i.archived || i.status === "dropped") continue;
    if (i.status in counts) counts[i.status as keyof StatusCounts] += 1;
  }
  return counts;
}

export interface DateBar {
  /** Share of the bar already used, up to the target (0 to 100). */
  fillPct: number;
  /** Where the target sits on the bar. */
  targetPct: number;
  /** Red stretch from the target to today when the target has passed (0 when it has not). */
  overPct: number;
  /** Where the Today tick sits. */
  tickPct: number;
  /** Days past the target as of today; 0 when on time or the project is finished. */
  overDays: number;
}

/**
 * The bar runs from the start date to the target, or to today when today is already past the target.
 * Returns null when there is no start or target, because there is nothing honest to draw.
 */
export function dateBar(opts: { start: string | null; target: string | null; today: string; finished: boolean }): DateBar | null {
  const { start, target, today, finished } = opts;
  if (!start || !target) return null;
  const over = finished ? 0 : overdueDays(target, today);
  const end = over > 0 ? today : target;
  const span = Math.max(1, daysBetween(start, end));
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const targetPct = clamp((daysBetween(start, target) / span) * 100);
  const tickPct = clamp((daysBetween(start, today) / span) * 100);
  return {
    fillPct: Math.min(tickPct, targetPct),
    targetPct,
    overPct: over > 0 ? Math.max(0, tickPct - targetPct) : 0,
    tickPct,
    overDays: over,
  };
}
