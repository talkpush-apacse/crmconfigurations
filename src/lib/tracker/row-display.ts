/**
 * Small rules for how a List row looks: the due pill's colour and the owner avatar's letters.
 * Pure functions, no React, no database.
 */
import { addDays, overdueDays } from "./dates";
import { DUE_SOON_DAYS } from "./attention";
import { OPEN_ITEM_STATUSES } from "./constants";

/**
 * none: no date. closed: done or dropped, shown quietly. over: open and past due. soon: open and due within a week.
 * ok: open with a date further out.
 */
export type DueKind = "none" | "closed" | "over" | "soon" | "ok";

export function dueKind(item: { status: string; dueDate: string | null }, today: string): DueKind {
  if (!item.dueDate) return "none";
  if (!(OPEN_ITEM_STATUSES as readonly string[]).includes(item.status)) return "closed";
  if (overdueDays(item.dueDate, today) > 0) return "over";
  if (item.dueDate <= addDays(today, DUE_SOON_DAYS)) return "soon";
  return "ok";
}

/** Up to two capital letters for an avatar: "Ana Reyes (demo)" is AR, "Cher" is C. Empty when there is no name. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}
