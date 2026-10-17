/**
 * Which items need a person's attention: the bell beside Share and its "Show in list" filter both use this,
 * so the number on the bell always matches the rows the list shows. Pure functions, no React, no database.
 */
import { addDays, overdueDays } from "./dates";
import { OPEN_ITEM_STATUSES } from "./constants";

export const ATTENTION_KINDS = ["blocked", "overdue", "waiting", "due_soon"] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/** How many days ahead counts as "due soon". */
export const DUE_SOON_DAYS = 7;

export interface AttentionRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  archived?: boolean;
}

export interface AttentionItem<T extends AttentionRow = AttentionRow> {
  item: T;
  kind: AttentionKind;
  /** Days past due; 0 unless the kind is "overdue" (or a blocked item that is also late). */
  lateDays: number;
}

const isOpen = (status: string) => (OPEN_ITEM_STATUSES as readonly string[]).includes(status);

/**
 * One reason per item, worst first: blocked, then overdue, then waiting on the client, then due within a week.
 * Done, dropped and archived items never need attention.
 */
export function attentionKind(row: AttentionRow, today: string): AttentionKind | null {
  if (row.archived || !isOpen(row.status)) return null;
  if (row.status === "blocked") return "blocked";
  if (overdueDays(row.dueDate, today) > 0) return "overdue";
  if (row.status === "waiting_on_client") return "waiting";
  if (row.dueDate && row.dueDate >= today && row.dueDate <= addDays(today, DUE_SOON_DAYS)) return "due_soon";
  return null;
}

/** Items needing attention, ordered blocked, overdue (most late first), waiting, due soon (soonest first). */
export function attentionItems<T extends AttentionRow>(items: readonly T[], today: string): AttentionItem<T>[] {
  const out: AttentionItem<T>[] = [];
  for (const item of items) {
    const kind = attentionKind(item, today);
    if (kind) out.push({ item, kind, lateDays: overdueDays(item.dueDate, today) });
  }
  const rank = (k: AttentionKind) => ATTENTION_KINDS.indexOf(k);
  return out.sort(
    (a, b) =>
      rank(a.kind) - rank(b.kind) ||
      b.lateDays - a.lateDays ||
      (a.item.dueDate ?? "9999-99-99").localeCompare(b.item.dueDate ?? "9999-99-99")
  );
}

/** The bell turns red when anything is overdue or blocked, otherwise amber. */
export function attentionIsUrgent(list: readonly { kind: AttentionKind }[]): boolean {
  return list.some((a) => a.kind === "blocked" || a.kind === "overdue");
}
