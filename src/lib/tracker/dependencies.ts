export interface DependencyEdge {
  /** The item that has to wait. */
  itemId: string;
  /** The item it is waiting for. */
  blockedByItemId: string;
}

/**
 * Would "itemId is blocked by blockedByItemId" create a loop?
 * It does when blockedByItemId already depends, directly or through other
 * items, on itemId (or when they are the same item).
 */
export function wouldCreateCycle(
  edges: readonly DependencyEdge[],
  itemId: string,
  blockedByItemId: string
): boolean {
  if (itemId === blockedByItemId) return true;
  const waitsFor = new Map<string, string[]>();
  for (const e of edges) {
    const list = waitsFor.get(e.itemId) ?? [];
    list.push(e.blockedByItemId);
    waitsFor.set(e.itemId, list);
  }
  const seen = new Set<string>();
  const stack = [blockedByItemId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === itemId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of waitsFor.get(current) ?? []) stack.push(next);
  }
  return false;
}

/**
 * Validate replacing an item's whole "blocked by" list.
 * `existingEdges` are all edges in the project EXCEPT the ones owned by itemId.
 */
export function validateDependencySet(
  existingEdges: readonly DependencyEdge[],
  itemId: string,
  newBlockedBy: readonly string[],
  knownItemIds: ReadonlySet<string>
): { ok: true; blockedBy: string[] } | { ok: false; error: string } {
  const unique = Array.from(new Set(newBlockedBy));
  for (const id of unique) {
    if (!knownItemIds.has(id)) return { ok: false, error: "A dependency points at an item outside this project." };
  }
  const edges = [...existingEdges];
  for (const id of unique) {
    if (wouldCreateCycle(edges, itemId, id)) {
      return { ok: false, error: "That dependency would create a loop (items waiting on each other)." };
    }
    edges.push({ itemId, blockedByItemId: id });
  }
  return { ok: true, blockedBy: unique };
}

/** Blockers that are neither done nor dropped. */
export function unmetDependencies(
  itemId: string,
  edges: readonly DependencyEdge[],
  statusById: ReadonlyMap<string, string>
): string[] {
  return edges
    .filter((e) => e.itemId === itemId)
    .map((e) => e.blockedByItemId)
    .filter((id) => {
      const status = statusById.get(id);
      return status !== undefined && status !== "done" && status !== "dropped";
    });
}
