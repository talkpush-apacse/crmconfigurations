/**
 * A copy of unsaved typing, kept on the person's own device.
 *
 * The page sends edits to the server about a second after typing stops (see draft-commit.ts and useChecklist.ts).
 * A phone that locks, a tab that crashes or a battery that dies inside that second still loses the typing, because a
 * network request cannot be relied on while a page is being put away. Writing to the browser's own storage is
 * instant, so the page keeps a copy of everything that is not saved yet and offers it back on the next visit.
 *
 * Rules that keep this from causing harm:
 *  - The copy holds only the fields with unsaved edits, as "before" (base) and "after" (mine). It is removed as soon
 *    as the server confirms the save. It never leaves the device.
 *  - Restoring is a three-way merge against the checklist as it is NOW, with the server winning any cell someone
 *    else changed in the meantime. A restore can add answers but never overwrite a newer saved one.
 *  - Each open page owns one entry (by writerId) and only ever changes its own, so two tabs on the same link do not
 *    delete each other's copy. Entries from other writers are what get offered for restore.
 *  - Entries expire after 14 days, and anything unreadable is ignored rather than trusted.
 * Nothing here knows about React. The page passes in a Storage so this can be tested without a browser.
 */
import type { ChecklistData } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/types";
import { MERGEABLE_FIELDS, deepEqual, mergeValue } from "@/lib/save-conflict-merge";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Only fields a person can edit in a checklist may be written back; stored text is never trusted to name others. */
const RESTORABLE_FIELDS: ReadonlySet<string> = new Set(Object.keys(FIELD_LABELS));

export interface BackupEntry {
  /** The page (one open tab) that wrote this. */
  writerId: string;
  /** When it was last written, in ms since 1970. */
  savedAt: number;
  /** The server version this page last agreed on when the edits began. */
  baseVersion: number;
  /** Each unsaved field as it was when last agreed with the server. */
  base: Record<string, unknown>;
  /** Each unsaved field as it is on screen. */
  mine: Record<string, unknown>;
}

export function backupKey(mode: "slug" | "token" | "id", slugOrToken: string): string {
  return `crm-config-unsaved:v${BACKUP_FORMAT_VERSION}:${mode}:${slugOrToken}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown, now: number): value is BackupEntry {
  if (!isRecord(value)) return false;
  if (typeof value.writerId !== "string" || value.writerId === "") return false;
  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) return false;
  if (typeof value.baseVersion !== "number") return false;
  if (!isRecord(value.base) || !isRecord(value.mine)) return false;
  if (now - value.savedAt > BACKUP_MAX_AGE_MS) return false;
  return true;
}

/** Everything valid in the stored text. A damaged or old-format value gives an empty list, never an exception. */
export function parseEntries(raw: string | null, now: number): BackupEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== BACKUP_FORMAT_VERSION || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter((entry): entry is BackupEntry => isEntry(entry, now));
  } catch {
    return [];
  }
}

/** The entry for the fields still waiting to be saved, or null when there is nothing unsaved. */
export function buildEntry(input: {
  writerId: string;
  now: number;
  base: ChecklistData;
  mine: ChecklistData;
  dirtyFields: string[];
}): BackupEntry | null {
  const base: Record<string, unknown> = {};
  const mine: Record<string, unknown> = {};
  const baseRecord = input.base as unknown as Record<string, unknown>;
  const mineRecord = input.mine as unknown as Record<string, unknown>;
  for (const field of input.dirtyFields) {
    if (!RESTORABLE_FIELDS.has(field)) continue;
    if (deepEqual(baseRecord[field], mineRecord[field])) continue; // edited and put back: nothing to keep
    base[field] = baseRecord[field] ?? null;
    mine[field] = mineRecord[field] ?? null;
  }
  if (Object.keys(mine).length === 0) return null;
  return { writerId: input.writerId, savedAt: input.now, baseVersion: input.base.version, base, mine };
}

/** Replace this writer's entry (or add it), leaving every other writer's entry exactly as it was. */
export function withEntry(entries: BackupEntry[], entry: BackupEntry): BackupEntry[] {
  return [...entries.filter((e) => e.writerId !== entry.writerId), entry];
}

export function withoutWriters(entries: BackupEntry[], writerIds: string[]): BackupEntry[] {
  return entries.filter((e) => !writerIds.includes(e.writerId));
}

export type StoreResult = { ok: true } | { ok: false };

/** Read the entries stored under `key`. A browser that blocks storage simply has none. */
export function readEntries(storage: Pick<Storage, "getItem">, key: string, now: number): BackupEntry[] {
  try {
    return parseEntries(storage.getItem(key), now);
  } catch {
    return [];
  }
}

/** Write the entries (or remove the key when there are none). Reports failure instead of hiding it. */
export function writeEntries(
  storage: Pick<Storage, "setItem" | "removeItem">,
  key: string,
  entries: BackupEntry[]
): StoreResult {
  try {
    if (entries.length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify({ v: BACKUP_FORMAT_VERSION, entries }));
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export interface RestorePlan {
  /** The new value of each field that restoring would change on top of the latest saved copy. */
  changes: Record<string, unknown>;
  /** Names of the fields in `changes`. */
  fields: string[];
  /** True when the checklist was saved by someone since these edits began, so some cells may keep the newer value. */
  serverMoved: boolean;
}

/**
 * What restoring these entries would change, given the latest copy from the server. Entries are applied oldest first.
 * Empty `fields` means everything in the copy is already saved (or was overtaken by newer saved answers).
 */
export function planRestore(entries: BackupEntry[], latest: ChecklistData): RestorePlan {
  const current: Record<string, unknown> = { ...(latest as unknown as Record<string, unknown>) };
  const changes: Record<string, unknown> = {};
  let serverMoved = false;

  const ordered = [...entries].sort((a, b) => a.savedAt - b.savedAt);
  for (const entry of ordered) {
    if (entry.baseVersion !== latest.version) serverMoved = true;
    for (const field of Object.keys(entry.mine)) {
      if (!RESTORABLE_FIELDS.has(field)) continue;
      const base = entry.base[field];
      const mine = entry.mine[field];
      const server = current[field];

      // Swapping the roles in the page's normal three-way merge makes the server the side that wins a clash.
      const result = MERGEABLE_FIELDS.has(field)
        ? mergeValue(base, server, mine)
        : deepEqual(server, base)
          ? mine
          : server;

      if (!deepEqual(result, server)) {
        current[field] = result;
        changes[field] = result;
      }
    }
  }
  return { changes, fields: Object.keys(changes), serverMoved };
}

/** "3 minutes ago" style wording for the newest entry, kept here so the banner stays dumb. */
export function newestSavedAt(entries: BackupEntry[]): number {
  return entries.reduce((latest, e) => Math.max(latest, e.savedAt), 0);
}
