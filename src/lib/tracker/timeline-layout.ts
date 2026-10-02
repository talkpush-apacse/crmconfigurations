import { addDays, daysBetween } from "./dates";
import { itemSpan, findDependencyConflicts, type ScheduleItem } from "./schedule";

/**
 * Pure layout for the Gantt timeline: which rows exist, where each bar sits (in
 * whole days from the start of the visible range), and which arrows to draw.
 * The component only turns these numbers into pixels, so everything here is testable.
 */

export type Zoom = "weeks" | "months";
export const PX_PER_DAY: Record<Zoom, number> = { weeks: 24, months: 6 };

export interface TimelineItem extends ScheduleItem {
  phaseId: string | null;
  ownerName: string | null;
  sortOrder: number;
}

export interface TimelinePhase {
  id: string;
  name: string;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

export interface TimelineInput {
  items: readonly TimelineItem[];
  phases: readonly TimelinePhase[];
  project: { startDate: string | null; targetDate: string | null; goLiveDate: string | null };
  today: string;
}

export interface PhaseRow {
  kind: "phase";
  id: string;
  name: string;
  /** Day offsets, inclusive, when the phase has dates. */
  startDay: number | null;
  endDay: number | null;
  scheduledCount: number;
}

export interface ItemRow {
  kind: "item";
  id: string;
  item: TimelineItem;
  startDay: number;
  /** Inclusive last day. */
  endDay: number;
  conflict: boolean;
}

export interface Arrow {
  fromId: string;
  toId: string;
  conflict: boolean;
}

export interface Timeline {
  rangeStart: string;
  rangeEnd: string;
  days: number;
  rows: (PhaseRow | ItemRow)[];
  arrows: Arrow[];
  unscheduled: TimelineItem[];
  markers: { today: number | null; target: number | null; goLive: number | null };
  months: { label: string; startDay: number; days: number }[];
  weeks: { startDay: number; label: string }[];
  /** Dependencies drawn vs dependencies that could not be (one end has no dates). */
  undatedDependencies: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

/** The Monday on or before a date. */
function mondayOnOrBefore(date: string): string {
  const w = weekday(date);
  return addDays(date, -((w + 6) % 7));
}

export function buildTimeline(input: TimelineInput): Timeline | null {
  const visible = input.items.filter((i) => i.status !== "dropped");
  const scheduled = visible.filter((i) => itemSpan(i) !== null);
  const dates: string[] = [];
  for (const i of scheduled) {
    const s = itemSpan(i)!;
    dates.push(s.start, s.end);
  }
  for (const p of input.phases) {
    if (p.startDate) dates.push(p.startDate);
    if (p.endDate) dates.push(p.endDate);
  }
  for (const d of [input.project.startDate, input.project.targetDate, input.project.goLiveDate]) if (d) dates.push(d);
  if (dates.length === 0) return null;
  dates.push(input.today);

  const sorted = [...dates].sort();
  const rangeStart = mondayOnOrBefore(addDays(sorted[0], -7));
  const lastDay = addDays(sorted[sorted.length - 1], 14);
  const rangeEnd = addDays(mondayOnOrBefore(lastDay), 6); // the Sunday of that week
  const days = daysBetween(rangeStart, rangeEnd) + 1;
  const day = (d: string) => daysBetween(rangeStart, d);

  // Rows: each phase (in order) with its scheduled items, then items with no phase.
  const phases = [...input.phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const conflicts = new Set(findDependencyConflicts(visible).map((c) => `${c.blockerId}>${c.itemId}`));
  const rows: (PhaseRow | ItemRow)[] = [];
  const groups: { id: string; name: string; startDate: string | null; endDate: string | null; items: TimelineItem[] }[] = phases.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate,
    endDate: p.endDate,
    items: scheduled.filter((i) => i.phaseId === p.id),
  }));
  const phaseIds = new Set(phases.map((p) => p.id));
  const loose = scheduled.filter((i) => !i.phaseId || !phaseIds.has(i.phaseId));
  if (loose.length > 0) groups.push({ id: "__none", name: "No phase", startDate: null, endDate: null, items: loose });

  for (const g of groups) {
    if (g.items.length === 0 && !g.startDate) continue;
    rows.push({
      kind: "phase",
      id: g.id,
      name: g.name,
      startDay: g.startDate ? day(g.startDate) : null,
      endDay: g.endDate || g.startDate ? day((g.endDate ?? g.startDate) as string) : null,
      scheduledCount: g.items.length,
    });
    for (const item of [...g.items].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const s = itemSpan(item)!;
      const hasConflict = item.blockedByItemIds.some((b) => conflicts.has(`${b}>${item.id}`));
      rows.push({ kind: "item", id: item.id, item, startDay: day(s.start), endDay: day(s.end), conflict: hasConflict });
    }
  }

  const visibleIds = new Set(visible.map((v) => v.id));
  const rowIds = new Set(rows.filter((r): r is ItemRow => r.kind === "item").map((r) => r.id));
  const arrows: Arrow[] = [];
  let undated = 0;
  for (const item of visible) {
    for (const blocker of item.blockedByItemIds) {
      if (!visibleIds.has(blocker)) continue; // dropped or archived blockers draw nothing
      if (rowIds.has(blocker) && rowIds.has(item.id)) arrows.push({ fromId: blocker, toId: item.id, conflict: conflicts.has(`${blocker}>${item.id}`) });
      else undated++;
    }
  }

  const months: Timeline["months"] = [];
  for (let d = 0; d < days; ) {
    const date = addDays(rangeStart, d);
    const [y, m] = date.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0)).getUTCDate(); // days in month
    const left = monthEnd - Number(date.slice(8, 10)) + 1;
    const span = Math.min(left, days - d);
    months.push({ label: `${MONTHS[m - 1]} ${y}`, startDay: d, days: span });
    d += span;
  }
  const weeks: Timeline["weeks"] = [];
  for (let d = 0; d < days; d += 7) {
    const date = addDays(rangeStart, d);
    weeks.push({ startDay: d, label: `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}` });
  }

  const inRange = (d: string | null) => (d && d >= rangeStart && d <= rangeEnd ? day(d) : null);
  return {
    rangeStart,
    rangeEnd,
    days,
    rows,
    arrows,
    unscheduled: visible.filter((i) => itemSpan(i) === null),
    markers: { today: inRange(input.today), target: inRange(input.project.targetDate), goLive: inRange(input.project.goLiveDate) },
    months,
    weeks,
    undatedDependencies: undated,
  };
}
