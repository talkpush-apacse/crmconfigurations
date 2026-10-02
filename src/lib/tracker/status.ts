import type { ItemStatus } from "./constants";
import { ITEM_STATUSES } from "./constants";

export interface StatusState {
  status: string;
  blockerReason: string | null;
  completedAt: Date | null;
}

export interface StatusChangeInput {
  /** Required when moving to "blocked" and no reason is stored yet. */
  blockerReason?: string | null;
}

export type StatusChangeResult =
  | { ok: true; changed: boolean; patch: StatusState }
  | { ok: false; error: string };

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && (ITEM_STATUSES as readonly string[]).includes(value);
}

/**
 * Decide what a status change does to the other fields it controls.
 * Pure: the caller persists the returned patch.
 *
 *  - blocked needs a reason; leaving blocked clears the reason
 *  - done stamps completedAt; leaving done clears it
 */
export function planStatusChange(
  current: StatusState,
  next: string,
  input: StatusChangeInput = {},
  now: Date = new Date()
): StatusChangeResult {
  if (!isItemStatus(next)) {
    return { ok: false, error: `Unknown status "${next}"` };
  }

  let blockerReason = current.blockerReason;
  if (input.blockerReason !== undefined) {
    blockerReason = input.blockerReason?.trim() ? input.blockerReason.trim() : null;
  }

  if (next === "blocked") {
    if (!blockerReason) {
      return { ok: false, error: "A blocker reason is required to mark an item as blocked." };
    }
  } else {
    blockerReason = null;
  }

  let completedAt = current.completedAt;
  if (next === "done") {
    completedAt = current.status === "done" && current.completedAt ? current.completedAt : now;
  } else {
    completedAt = null;
  }

  const changed =
    current.status !== next ||
    current.blockerReason !== blockerReason ||
    (current.completedAt === null) !== (completedAt === null);

  return { ok: true, changed, patch: { status: next, blockerReason, completedAt } };
}
