/**
 * Kanban ordering. Items have one project-wide sortOrder; a board column is just
 * the items with that status. When a card is dropped we compute the new
 * project-wide order so it lands where the user put it.
 */

export function moveWithin<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/**
 * New global order after dropping `activeId`.
 *  - `beforeId`: put it immediately before this item
 *  - else `afterId`: put it immediately after this item
 *  - else: put it back where it was (nothing to anchor to)
 */
export function computeGlobalOrder(
  orderedIds: readonly string[],
  activeId: string,
  anchor: { beforeId?: string | null; afterId?: string | null }
): string[] {
  const originalIndex = orderedIds.indexOf(activeId);
  const rest = orderedIds.filter((id) => id !== activeId);
  let at = Math.min(Math.max(originalIndex, 0), rest.length);
  if (anchor.beforeId && rest.includes(anchor.beforeId)) at = rest.indexOf(anchor.beforeId);
  else if (anchor.afterId && rest.includes(anchor.afterId)) at = rest.indexOf(anchor.afterId) + 1;
  rest.splice(at, 0, activeId);
  return rest;
}

/**
 * Where did a drop land? `columnIds` is the target column's current order
 * (active item included when it is the same column). `overId` is the card it was
 * dropped on, or null when dropped on the column body (meaning "at the end").
 */
export function dropAnchor(
  columnIds: readonly string[],
  activeId: string,
  overId: string | null
): { beforeId: string | null; afterId: string | null } {
  // Dropped on itself: nothing to anchor to, so it stays where it was.
  if (overId === activeId) return { beforeId: null, afterId: null };
  const without = columnIds.filter((id) => id !== activeId);
  if (overId === null || !columnIds.includes(overId)) {
    return { beforeId: null, afterId: without.length > 0 ? without[without.length - 1] : null };
  }
  const from = columnIds.indexOf(activeId);
  const to = columnIds.indexOf(overId);
  const sameColumn = from !== -1;
  // Dragging down inside a column lands AFTER the card it is dropped on; everything else lands before it.
  if (sameColumn && from < to) return { beforeId: null, afterId: overId };
  return { beforeId: overId, afterId: null };
}
