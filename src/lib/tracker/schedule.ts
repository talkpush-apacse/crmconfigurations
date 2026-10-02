import { formatDate } from "./format";

/**
 * Scheduling rules shared by the timeline and the item sheet.
 * Dependencies are finish-to-start: an item should not START before the item
 * it waits for is DUE.
 */

export interface ScheduleItem {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  isMilestone: boolean;
  blockedByItemIds: readonly string[];
}

const CLOSED = ["done", "dropped"];

/** The days an item occupies, inclusive. Null when it has no dates at all. */
export function itemSpan(i: Pick<ScheduleItem, "startDate" | "dueDate">): { start: string; end: string } | null {
  const start = i.startDate ?? i.dueDate;
  const end = i.dueDate ?? i.startDate;
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

export interface DependencyConflict {
  itemId: string;
  blockerId: string;
  itemTitle: string;
  blockerTitle: string;
  itemStart: string;
  blockerEnd: string;
}

/** Wording for a conflict, in plain sentences. */
export function conflictMessage(c: DependencyConflict): string {
  return `"${c.blockerTitle}" is due ${formatDate(c.blockerEnd)}, but "${c.itemTitle}" is planned to start ${formatDate(c.itemStart)}.`;
}

/**
 * Every dependency where the waiting item starts before its blocker is due.
 * Closed items are ignored: a blocker that is already done no longer holds anything up.
 */
export function findDependencyConflicts(items: readonly ScheduleItem[]): DependencyConflict[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: DependencyConflict[] = [];
  for (const item of items) {
    if (CLOSED.includes(item.status)) continue;
    const span = itemSpan(item);
    if (!span) continue;
    for (const blockerId of item.blockedByItemIds) {
      const blocker = byId.get(blockerId);
      if (!blocker || CLOSED.includes(blocker.status)) continue;
      const bSpan = itemSpan(blocker);
      if (!bSpan) continue;
      if (span.start < bSpan.end) {
        out.push({ itemId: item.id, blockerId, itemTitle: item.title, blockerTitle: blocker.title, itemStart: span.start, blockerEnd: bSpan.end });
      }
    }
  }
  return out;
}

/** The same check for an item that is being edited (its dates are still in a form). */
export function draftConflicts(
  draft: { id?: string; title: string; status: string; startDate: string | null; dueDate: string | null },
  blockerIds: readonly string[],
  others: readonly ScheduleItem[]
): DependencyConflict[] {
  const id = draft.id ?? "__draft__";
  const item: ScheduleItem = { id, title: draft.title || "This item", status: draft.status, startDate: draft.startDate, dueDate: draft.dueDate, isMilestone: false, blockedByItemIds: blockerIds };
  return findDependencyConflicts([...others.filter((o) => o.id !== id), item]).filter((c) => c.itemId === id);
}
