import { uid } from "./template-data";
import { BULK_SECTIONS, type BulkSectionKey } from "./checklist-sections";

interface BaseRow {
  id?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

/**
 * Stamp `deletedAt = now` on every row in `fullArray` whose id is in `ids`.
 * Returns a new array — does not mutate.
 */
export function softDeleteByIds<T extends BaseRow>(
  fullArray: T[],
  ids: string[],
): T[] {
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  return fullArray.map((r) =>
    r.id && idSet.has(r.id) ? ({ ...r, deletedAt: now } as T) : r,
  );
}

/**
 * Append collision-aware copies of the visible rows whose ids are in `ids` to
 * the end of `fullArray`. Returns a new array.
 */
export function appendBulkDuplicates<T extends BaseRow>(
  section: BulkSectionKey,
  fullArray: T[],
  visibleArray: T[],
  ids: string[],
): T[] {
  const idSet = new Set(ids);
  const sources = visibleArray.filter((r) => r.id && idSet.has(r.id));
  if (sources.length === 0) return fullArray;
  const copies = duplicateRows(section, fullArray, sources);
  return [...fullArray, ...copies];
}

/**
 * Build collision-aware copies of the given source rows for one section.
 *
 * - Generates a fresh `id` per copy and clears `deletedAt`/`deletedBy`.
 * - Applies the section's duplicate strategy to its `duplicateField`:
 *     name_suffix:  "Recruiter A" -> "Recruiter A (copy)" -> "Recruiter A (copy 2)"
 *     email_suffix: "x@y.com"     -> "x+copy@y.com"        -> "x+copy2@y.com"
 *     as_is:        clones the field value unchanged
 *
 * Collision detection runs against the *full* existing array (incl. previously
 * appended copies in this same call), so a 3-row duplicate produces three
 * distinct suffixes instead of three identical ones.
 */
export function duplicateRows<T extends BaseRow>(
  section: BulkSectionKey,
  fullArray: T[],
  rowsToClone: T[],
): T[] {
  const config = BULK_SECTIONS[section];
  const working: T[] = [...fullArray];
  const copies: T[] = [];

  for (const source of rowsToClone) {
    const copy = { ...source, id: uid() } as T;
    // Clear soft-delete metadata on copies
    (copy as BaseRow).deletedAt = null;
    (copy as BaseRow).deletedBy = null;

    if (config.duplicateField && config.duplicateStrategy !== "as_is") {
      const indexable = source as unknown as Record<string, unknown>;
      const original = String(indexable[config.duplicateField] ?? "");
      const next = nextAvailable(
        original,
        config.duplicateStrategy,
        working,
        config.duplicateField,
      );
      (copy as unknown as Record<string, unknown>)[config.duplicateField] = next;
    }

    working.push(copy);
    copies.push(copy);
  }

  return copies;
}

function nextAvailable<T extends BaseRow>(
  original: string,
  strategy: "name_suffix" | "email_suffix",
  existing: T[],
  field: string,
): string {
  const taken = new Set(
    existing
      .filter((r) => !r.deletedAt)
      .map((r) => String((r as unknown as Record<string, unknown>)[field] ?? "")),
  );
  for (let n = 1; n <= 999; n++) {
    const candidate = applySuffix(original, strategy, n);
    if (!taken.has(candidate)) return candidate;
  }
  // Fallback — should never realistically hit
  return applySuffix(original, strategy, 999);
}

function applySuffix(
  original: string,
  strategy: "name_suffix" | "email_suffix",
  n: number,
): string {
  if (strategy === "email_suffix") {
    const at = original.indexOf("@");
    const tag = n === 1 ? "copy" : `copy${n}`;
    if (at === -1) return `${original}+${tag}`;
    return `${original.slice(0, at)}+${tag}${original.slice(at)}`;
  }
  // name_suffix
  const tag = n === 1 ? "(copy)" : `(copy ${n})`;
  return original ? `${original} ${tag}` : tag;
}
