/**
 * Merging a rejected save instead of throwing the person's typing away.
 *
 * The server refuses a save when someone else has saved the same field since this page loaded (a Talkpush admin,
 * a teammate on another link, an automated edit). Custom tabs are stored as one block, so a save to ANY custom
 * tab makes every other open page "out of date" for custom tabs. Before this, the page said "please reload", and
 * reloading discarded whatever had been typed.
 *
 * Here the page's own edits are replayed on top of the latest server copy instead. It is a three-way merge:
 *   base   = what the page last agreed on with the server
 *   mine   = what is on screen now (base + this person's edits)
 *   theirs = the latest copy on the server (base + everyone else's edits)
 * Each cell is taken from whichever side changed it. If both sides changed the same cell, the person typing wins.
 * Nothing here talks to the network; the save hook does the fetching and retrying.
 */
import type { ChecklistData } from "@/lib/types";

/**
 * Fields that are safe to merge piece by piece: tabs and rows of custom tabs, and the answers of custom form tabs.
 * Anything else that conflicts keeps the old "please reload" message.
 */
export const MERGEABLE_FIELDS: ReadonlySet<string> = new Set(["customTabs", "customData"]);

type Json = unknown;

function isPlainObject(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasId(value: Json): value is Record<string, Json> & { id: string } {
  return isPlainObject(value) && typeof value.id === "string" && value.id !== "";
}

/**
 * A list whose every element is an object with a string `id` (tabs, rows, fields), so elements can be matched up.
 * An empty list counts: a tab with no rows yet is still a list of rows.
 */
function isIdList(value: Json): value is Array<Record<string, Json> & { id: string }> {
  return Array.isArray(value) && value.every(hasId);
}

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a)) {
    if (!isPlainObject(b)) return false;
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return false;
    return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

/** Merge two lists of id-keyed items (tabs, rows). Returns the merged list in the server's order. */
function mergeIdArrays(
  base: Array<Record<string, Json> & { id: string }>,
  mine: Array<Record<string, Json> & { id: string }>,
  theirs: Array<Record<string, Json> & { id: string }>
): Array<Record<string, Json>> {
  const byId = (list: typeof base) => new Map(list.map((item) => [item.id, item]));
  const baseById = byId(base);
  const mineById = byId(mine);
  const theirsById = byId(theirs);

  const result: Array<Record<string, Json>> = [];
  for (const theirItem of theirs) {
    const id = theirItem.id;
    const baseItem = baseById.get(id);
    const mineItem = mineById.get(id);

    if (mineItem === undefined) {
      // Not on this page's screen. If it was there when the page loaded, this person removed it: honour that,
      // unless someone else has edited it since (their work is kept).
      if (baseItem !== undefined && deepEqual(theirItem, baseItem)) continue;
      result.push(theirItem);
      continue;
    }
    result.push(mergeValue(baseItem, mineItem, theirItem) as Record<string, Json>);
  }

  // Items that exist on this page but not on the server copy.
  mine.forEach((mineItem, index) => {
    if (theirsById.has(mineItem.id)) return;
    const baseItem = baseById.get(mineItem.id);
    // Removed on the server. Keep it only if this person edited it (so their typing is not lost).
    if (baseItem !== undefined && deepEqual(mineItem, baseItem)) return;

    // Put it where it sat on this person's screen: after the nearest earlier item that is still in the result,
    // else before the nearest later one, else at the end.
    const positionOf = (id: string) => result.findIndex((item) => item.id === id);
    for (let i = index - 1; i >= 0; i--) {
      const at = positionOf(mine[i].id);
      if (at !== -1) {
        result.splice(at + 1, 0, mineItem);
        return;
      }
    }
    for (let i = index + 1; i < mine.length; i++) {
      const at = positionOf(mine[i].id);
      if (at !== -1) {
        result.splice(at, 0, mineItem);
        return;
      }
    }
    result.push(mineItem);
  });

  return result;
}

/**
 * Three-way merge of any JSON value. `undefined` means "not present". See the file header for the rules.
 */
export function mergeValue(base: Json, mine: Json, theirs: Json): Json {
  if (deepEqual(mine, base)) return theirs; // this person did not touch it
  if (deepEqual(theirs, base)) return mine; // nobody else touched it
  if (deepEqual(mine, theirs)) return mine; // both made the same change

  if (isPlainObject(mine) && isPlainObject(theirs)) {
    const baseObject = isPlainObject(base) ? base : {};
    const merged: Record<string, Json> = {};
    const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
    for (const key of keys) {
      const inMine = Object.prototype.hasOwnProperty.call(mine, key);
      const inTheirs = Object.prototype.hasOwnProperty.call(theirs, key);
      const baseValue = baseObject[key];
      const hadInBase = Object.prototype.hasOwnProperty.call(baseObject, key);

      if (inMine && inTheirs) {
        merged[key] = mergeValue(baseValue, mine[key], theirs[key]);
      } else if (inMine) {
        // Only on this page. A removal by someone else wins only if this person had not changed the value.
        if (hadInBase && deepEqual(mine[key], baseValue)) continue;
        merged[key] = mine[key];
      } else {
        // Only on the server. A removal by this person wins only if nobody else has changed the value.
        if (hadInBase && deepEqual(theirs[key], baseValue)) continue;
        merged[key] = theirs[key];
      }
    }
    return merged;
  }

  if (isIdList(mine) && isIdList(theirs)) {
    return mergeIdArrays(isIdList(base) ? base : [], mine, theirs);
  }

  // Plain values, or shapes that do not line up: both sides changed it, so the person typing wins.
  return mine;
}

export interface RebaseInput {
  /** What this page last agreed on with the server. */
  base: ChecklistData;
  /** What is on screen now. */
  mine: ChecklistData;
  /** The latest copy from the server. */
  theirs: ChecklistData;
  /** The fields this page has changed and still needs to save. */
  dirtyFields: string[];
  /** The fields the server named in its 409. */
  conflictedFields: string[];
}

export type RebaseResult =
  | { ok: true; next: ChecklistData }
  | { ok: false; unmergeable: string[] };

/**
 * Replays this page's unsaved edits onto the latest server copy.
 *
 * The result takes the server's version number, so every field this page has NOT edited is taken from the server
 * as well: otherwise a later save of such a field would carry the new version number but old content, and
 * silently undo someone else's change.
 */
export function rebaseOntoServer({ base, mine, theirs, dirtyFields, conflictedFields }: RebaseInput): RebaseResult {
  const unmergeable = conflictedFields.filter((field) => !MERGEABLE_FIELDS.has(field));
  if (unmergeable.length > 0) return { ok: false, unmergeable };

  const next: Record<string, unknown> = { ...(theirs as unknown as Record<string, unknown>) };
  const baseRecord = base as unknown as Record<string, unknown>;
  const mineRecord = mine as unknown as Record<string, unknown>;
  const theirsRecord = theirs as unknown as Record<string, unknown>;

  for (const field of dirtyFields) {
    if (MERGEABLE_FIELDS.has(field)) {
      next[field] = mergeValue(baseRecord[field], mineRecord[field], theirsRecord[field]);
    } else if (!conflictedFields.includes(field)) {
      // Edited here, untouched on the server since this page loaded: the on-screen value stands.
      next[field] = mineRecord[field];
    }
  }
  return { ok: true, next: next as unknown as ChecklistData };
}
