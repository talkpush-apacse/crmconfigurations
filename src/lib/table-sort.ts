import type { ColumnDef } from "@/lib/types";

export type SortDirection = "asc" | "desc";

type SortableRow = { id?: string };

// Numeric-aware and case/accent-insensitive, so "Site 2" sorts before
// "Site 10" and "alpha" sits next to "Alpha".
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "boolean") return false;
  return String(value).trim().length === 0;
}

function compareValues(a: unknown, b: unknown): number {
  // A ticked box sorts after an unticked one, matching how A-Z puts "Yes"
  // after "No" without depending on what the cell happens to display.
  if (typeof a === "boolean" || typeof b === "boolean") {
    return Number(a === true) - Number(b === true);
  }
  return collator.compare(String(a).trim(), String(b).trim());
}

/**
 * Returns a new array of rows ordered by one column.
 *
 * Blank cells always go to the bottom, whichever direction is chosen: a Z-A
 * sort that opened with a screen of empty rows would hide the data the editor
 * is looking for. Rows that tie keep their current relative order.
 */
export function sortRowsByColumn<TRow extends SortableRow>(
  rows: TRow[],
  column: Pick<ColumnDef, "key">,
  direction: SortDirection
): TRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = (left.row as Record<string, unknown>)[column.key];
      const b = (right.row as Record<string, unknown>)[column.key];
      const aBlank = isBlank(a);
      const bBlank = isBlank(b);
      if (aBlank || bBlank) {
        if (aBlank && bBlank) return left.index - right.index;
        return aBlank ? 1 : -1;
      }
      return sign * compareValues(a, b) || left.index - right.index;
    })
    .map(({ row }) => row);
}

/**
 * Puts `rows` back in the order given by `orderedIds`.
 *
 * Used by "Undo sort". It restores only the ORDER, never the old row contents,
 * so anything typed or added after the sort is kept: rows that weren't there
 * when the sort happened go to the end.
 */
export function restoreRowOrder<TRow extends SortableRow>(
  rows: TRow[],
  orderedIds: string[]
): TRow[] {
  const position = new Map(orderedIds.map((id, index) => [id, index]));
  const known = rows
    .map((row, index) => ({ row, index, pos: row.id ? position.get(row.id) : undefined }))
    .filter((entry) => entry.pos !== undefined);
  const unknown = rows.filter((row) => !row.id || !position.has(row.id));
  known.sort((a, b) => (a.pos as number) - (b.pos as number));
  return [...known.map((entry) => entry.row), ...unknown];
}
