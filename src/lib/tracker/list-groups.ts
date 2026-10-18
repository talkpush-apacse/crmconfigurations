/**
 * Phase groups for the List tab: items under their phase, exceptions first, finished items folded into an
 * "n done" line. This changes what the screen shows, not which items match the filters, so exports are unaffected.
 * Pure functions, no React, no database.
 */
import { ATTENTION_KINDS, attentionKind } from "./attention";

export interface GroupRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  phaseId: string | null;
  archived?: boolean;
}

export interface PhaseGroup<T extends GroupRow> {
  /** Stable key: the phase id, or "none" for items without a phase. */
  key: string;
  name: string;
  /** Finished and counted items in the whole phase (not just the ones on screen), for "n/total". */
  done: number;
  total: number;
  /** Items shown as rows: exceptions first, then the rest in their usual order. */
  open: T[];
  /** Done and dropped items folded behind the "n done" line. */
  closed: T[];
}

export const NO_PHASE_KEY = "none";

const isClosed = (status: string) => status === "done" || status === "dropped";

/**
 * Whether finished items should be folded. Not when they are the point of the view: a Done or Dropped status
 * filter, or a search (a search for a finished item must find it).
 */
export function shouldFold(opts: { statusFilter: string; query: string }): boolean {
  if (opts.query.trim() !== "") return false;
  return opts.statusFilter !== "done" && opts.statusFilter !== "dropped";
}

/** "3 done", or "3 closed" when some of them were dropped. */
export function closedLabel(closed: readonly { status: string }[]): string {
  const dropped = closed.filter((c) => c.status === "dropped").length;
  return `${closed.length} ${dropped > 0 ? "closed" : "done"}`;
}

export function groupByPhase<T extends GroupRow>(
  visible: readonly T[],
  opts: { phases: readonly { id: string; name: string }[]; allItems: readonly GroupRow[]; today: string; fold: boolean }
): PhaseGroup<T>[] {
  const { phases, allItems, today, fold } = opts;
  const known = new Set(phases.map((p) => p.id));
  const keyOf = (phaseId: string | null) => (phaseId && known.has(phaseId) ? phaseId : NO_PHASE_KEY);

  const totals = new Map<string, { done: number; total: number }>();
  for (const i of allItems) {
    if (i.archived || i.status === "dropped") continue;
    const t = totals.get(keyOf(i.phaseId)) ?? { done: 0, total: 0 };
    t.total += 1;
    if (i.status === "done") t.done += 1;
    totals.set(keyOf(i.phaseId), t);
  }

  const rank = (r: T) => {
    const kind = attentionKind(r, today);
    return kind ? ATTENTION_KINDS.indexOf(kind) : ATTENTION_KINDS.length;
  };

  const order = [...phases.map((p) => ({ key: p.id, name: p.name })), { key: NO_PHASE_KEY, name: "No phase" }];
  const groups: PhaseGroup<T>[] = [];
  for (const { key, name } of order) {
    const rows = visible.filter((r) => keyOf(r.phaseId) === key);
    if (rows.length === 0) continue;
    const open = fold ? rows.filter((r) => !isClosed(r.status)) : [...rows];
    const closed = fold ? rows.filter((r) => isClosed(r.status)) : [];
    // Array.prototype.sort is stable, so rows of the same rank keep the order they came in.
    open.sort((a, b) => rank(a) - rank(b));
    const t = totals.get(key) ?? { done: 0, total: 0 };
    groups.push({ key, name, done: t.done, total: t.total, open, closed });
  }
  return groups;
}
