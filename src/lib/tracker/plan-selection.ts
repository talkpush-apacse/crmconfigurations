import { wouldCreateCycle } from "./dependencies";

/**
 * Pure rules for "tick / untick items, then apply" on a project's plan.
 * No database access: the service loads the data, calls these, and writes the result.
 */

export interface PlanItemRef {
  key: string;
  dependsOnKeys: readonly string[];
}

export interface ExistingPlanItem {
  id: string;
  templateItemKey: string;
  archived: boolean;
  status: string;
  title: string;
}

export interface PlanDiff {
  /** Ticked, and the project has no item for it yet. */
  create: string[];
  /** Ticked, and an archived item from an earlier plan exists: bring it back. */
  restore: string[];
  /** Unticked, and an active item exists: archive it. */
  archive: ExistingPlanItem[];
  /** Ticked and already active: left exactly as it is. */
  keep: string[];
  /** Part of `archive` that work has already started on or finished. Needs an explicit yes. */
  startedToArchive: ExistingPlanItem[];
}

/** Statuses that mean someone has already acted on the item. */
const UNTOUCHED = ["not_started"];

export function diffPlan(
  templateKeys: readonly string[],
  selectedKeys: ReadonlySet<string>,
  existing: readonly ExistingPlanItem[]
): PlanDiff {
  const byKey = new Map(existing.map((e) => [e.templateItemKey, e]));
  const diff: PlanDiff = { create: [], restore: [], archive: [], keep: [], startedToArchive: [] };
  for (const key of templateKeys) {
    const have = byKey.get(key);
    const wanted = selectedKeys.has(key);
    if (wanted) {
      if (!have) diff.create.push(key);
      else if (have.archived) diff.restore.push(key);
      else diff.keep.push(key);
    } else if (have && !have.archived) {
      diff.archive.push(have);
      if (!UNTOUCHED.includes(have.status)) diff.startedToArchive.push(have);
    }
  }
  return diff;
}

export interface PlanEdge {
  itemKey: string;
  blockedByKey: string;
}

export interface PlanEdges {
  add: PlanEdge[];
  /** Template dependencies that could not be created, with the reason in plain words. */
  dropped: (PlanEdge & { reason: string })[];
}

/**
 * The dependency links to create after an apply.
 *  - A new or restored item is linked to each of its template blockers that will be active.
 *  - Any other active plan item is linked to a blocker that is new or restored in this apply
 *    (the blocker was missing before, so the link could not exist).
 *  - Links between two untouched items are never re-added, so a link removed by hand stays removed.
 * `existingPairs` are links already in the project, as "itemKey>blockedByKey".
 */
export function planEdges(
  template: readonly PlanItemRef[],
  activeKeys: ReadonlySet<string>,
  freshKeys: ReadonlySet<string>,
  existingPairs: ReadonlySet<string>
): PlanEdges {
  const out: PlanEdges = { add: [], dropped: [] };
  const seen = new Set<string>();
  for (const t of template) {
    if (!activeKeys.has(t.key)) continue;
    for (const dep of t.dependsOnKeys) {
      const itemFresh = freshKeys.has(t.key);
      const blockerFresh = freshKeys.has(dep);
      if (!itemFresh && !blockerFresh) continue;
      const pair = `${t.key}>${dep}`;
      if (existingPairs.has(pair) || seen.has(pair)) continue;
      if (!activeKeys.has(dep)) {
        if (itemFresh) out.dropped.push({ itemKey: t.key, blockedByKey: dep, reason: "that item is not ticked" });
        continue;
      }
      seen.add(pair);
      out.add.push({ itemKey: t.key, blockedByKey: dep });
    }
  }
  return out;
}

/** Keep only the edges that do not create a loop with the links already in the project. */
export function filterLoopEdges(
  candidates: readonly { itemId: string; blockedByItemId: string }[],
  existing: readonly { itemId: string; blockedByItemId: string }[]
): { ok: { itemId: string; blockedByItemId: string }[]; loops: { itemId: string; blockedByItemId: string }[] } {
  const edges = [...existing];
  const ok: { itemId: string; blockedByItemId: string }[] = [];
  const loops: { itemId: string; blockedByItemId: string }[] = [];
  for (const c of candidates) {
    if (wouldCreateCycle(edges, c.itemId, c.blockedByItemId)) {
      loops.push(c);
    } else {
      edges.push(c);
      ok.push(c);
    }
  }
  return { ok, loops };
}

/** Is the template's own dependency graph free of loops and missing keys? Returns problems, empty when fine. */
export function templateGraphProblems(items: readonly PlanItemRef[]): string[] {
  const problems: string[] = [];
  const keys = new Set(items.map((i) => i.key));
  const edges: { itemId: string; blockedByItemId: string }[] = [];
  for (const i of items) {
    for (const dep of i.dependsOnKeys) {
      if (!keys.has(dep)) {
        problems.push(`"${i.key}" depends on "${dep}", which does not exist.`);
        continue;
      }
      if (wouldCreateCycle(edges, i.key, dep)) {
        problems.push(`"${i.key}" and "${dep}" would wait on each other.`);
        continue;
      }
      edges.push({ itemId: i.key, blockedByItemId: dep });
    }
  }
  return problems;
}
