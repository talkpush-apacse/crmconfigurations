/**
 * Filtering and sorting rules for the List view, shared by the staff List and the
 * read-only client List so the two can never disagree. Pure functions on plain
 * rows: no React, no database.
 */
import { addDays, daysBetween, overdueDays } from "./dates";
import { ITEM_STATUSES, OPEN_ITEM_STATUSES } from "./constants";

export interface ListRow {
  title: string;
  status: string;
  ownerName: string | null;
  phaseId: string | null;
  dueDate: string | null;
  sortOrder: number;
}

// ---- Due filter ------------------------------------------------------------

export const DUE_FILTERS = ["any", "overdue", "this_week", "next_7", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  any: "Any due date",
  overdue: "Overdue",
  this_week: "Due this week",
  next_7: "Due in next 7 days",
  none: "No due date",
};

const isOpenStatus = (status: string) => (OPEN_ITEM_STATUSES as readonly string[]).includes(status);

/** The Sunday that ends the Monday-to-Sunday week containing `today`. */
function endOfWeek(today: string): string {
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, weekday === 0 ? 0 : 7 - weekday);
}

/**
 * Overdue means a still-open item past its date (the same rule as the red "overdue" note in the
 * list). The two "due" windows look at the date only, so a done item due this week still shows.
 */
export function matchesDue(row: Pick<ListRow, "status" | "dueDate">, filter: DueFilter, today: string): boolean {
  switch (filter) {
    case "any":
      return true;
    case "none":
      return !row.dueDate;
    case "overdue":
      return isOpenStatus(row.status) && overdueDays(row.dueDate, today) > 0;
    case "this_week":
      return !!row.dueDate && row.dueDate >= today && row.dueDate <= endOfWeek(today);
    case "next_7":
      return !!row.dueDate && daysBetween(today, row.dueDate) >= 0 && daysBetween(today, row.dueDate) <= 7;
  }
}

// ---- Sorting ---------------------------------------------------------------

export const SORT_KEYS = ["item", "status", "owner", "phase", "due"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";
/** null means the default order: phase by phase, then the order items were added. */
export type SortState = { key: SortKey; dir: SortDir } | null;

export const SORT_KEY_LABELS: Record<SortKey, string> = {
  item: "Item",
  status: "Status",
  owner: "Owner",
  phase: "Phase",
  due: "Due",
};

/** Clicking a column header: ascending, then descending, then back to the default order. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** For screen readers: the value of `aria-sort` for a column header. */
export function ariaSort(current: SortState, key: SortKey): "ascending" | "descending" | "none" {
  if (!current || current.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/** Choices for the phone "Sort by" menu. "default" or "<key>:<asc|desc>". */
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "item:asc", label: "Item, A to Z" },
  { value: "item:desc", label: "Item, Z to A" },
  { value: "status:asc", label: "Status, first to last" },
  { value: "status:desc", label: "Status, last to first" },
  { value: "owner:asc", label: "Owner, A to Z" },
  { value: "owner:desc", label: "Owner, Z to A" },
  { value: "phase:asc", label: "Phase, first to last" },
  { value: "phase:desc", label: "Phase, last to first" },
  { value: "due:asc", label: "Due, earliest first" },
  { value: "due:desc", label: "Due, latest first" },
];

export function sortToValue(sort: SortState): string {
  return sort ? `${sort.key}:${sort.dir}` : "default";
}

export function sortFromValue(value: string): SortState {
  const [key, dir] = value.split(":");
  if (!(SORT_KEYS as readonly string[]).includes(key) || (dir !== "asc" && dir !== "desc")) return null;
  return { key: key as SortKey, dir };
}

const text = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * Sorted copy of `rows`. Rows with no value (no owner, no phase, no due date) always go last, in
 * either direction. Ties fall back to the default order, so the result never jumps around.
 */
export function sortRows<T extends ListRow>(rows: readonly T[], sort: SortState, phaseOrder: ReadonlyMap<string, number>): T[] {
  const phaseRank = (r: T) => (r.phaseId ? (phaseOrder.get(r.phaseId) ?? 99) : 100);
  const byDefault = (a: T, b: T) => phaseRank(a) - phaseRank(b) || a.sortOrder - b.sortOrder;
  if (!sort) return [...rows].sort(byDefault);

  const sign = sort.dir === "asc" ? 1 : -1;
  const statusRank = (r: T) => {
    const i = (ITEM_STATUSES as readonly string[]).indexOf(r.status);
    return i === -1 ? ITEM_STATUSES.length : i;
  };
  // Returns undefined when this row has no value for the column.
  const compare = (a: T, b: T): number | undefined => {
    switch (sort.key) {
      case "item":
        return text.compare(a.title, b.title);
      case "status":
        return statusRank(a) - statusRank(b);
      case "owner":
        return a.ownerName && b.ownerName ? text.compare(a.ownerName, b.ownerName) : undefined;
      case "phase":
        return a.phaseId && b.phaseId ? phaseRank(a) - phaseRank(b) : undefined;
      case "due":
        return a.dueDate && b.dueDate ? (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) : undefined;
    }
  };
  const hasValue = (r: T) => {
    if (sort.key === "owner") return !!r.ownerName;
    if (sort.key === "phase") return !!r.phaseId;
    if (sort.key === "due") return !!r.dueDate;
    return true;
  };

  return [...rows].sort((a, b) => {
    const ha = hasValue(a);
    const hb = hasValue(b);
    if (ha !== hb) return ha ? -1 : 1; // empty values last, whichever direction
    const c = compare(a, b);
    return (c ? c * sign : 0) || byDefault(a, b);
  });
}
