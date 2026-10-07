import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { diffChecklistFields, wholeDocumentEvent } from "./diff";
import { touchEditLink } from "./resolve";
import { COALESCE_WINDOW_MS, type DraftEvent, type EditActor } from "./types";

/**
 * Writes the changes a save made into the history.
 *
 * Runs AFTER the save has committed and the response is on its way (Next's `after()`), so it can never slow down
 * or fail someone's save. If the write fails it is logged and dropped; the History page says what it cannot promise.
 *
 * Merging: the same person changing the same cell within a 10-minute window shares one row. The database does the
 * merge in the same statement as the insert (ON CONFLICT on the unique coalesceKey), so two saves that overlap can
 * neither duplicate a row nor let an older value overwrite a newer one (the update only applies when the new
 * checklist version is higher). The row keeps its first "before" and its first time.
 */

const pending = new Set<Promise<void>>();

/**
 * Runs `task` once the response has been sent. Outside a request (tests, scripts) it just runs, and `flushEditHistory`
 * can be awaited. Errors never escape.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[edit-history] background write failed:", err instanceof Error ? err.message : err);
    }
  };
  try {
    after(safe);
    return;
  } catch {
    // Not inside a request: fall through and run it directly.
  }
  const p = safe().finally(() => pending.delete(p));
  pending.add(p);
}

/** For tests: wait for any background writes started outside a request. */
export async function flushEditHistory(): Promise<void> {
  while (pending.size > 0) await Promise.all(Array.from(pending));
}

function actorKey(actor: EditActor): string {
  return actor.linkId ?? `${actor.type}:${actor.name}`;
}

export function coalesceKeyFor(actor: EditActor, e: DraftEvent, now: number): string {
  const bucket = Math.floor(now / COALESCE_WINDOW_MS);
  // List items have no row id, so the item text keeps two different items from sharing one line.
  const detail = e.rowId ?? e.rowLabel ?? "";
  return createHash("sha1").update(`${actorKey(actor)}|${bucket}|${e.subject}|${detail}`).digest("hex");
}

const jsonOrNull = (v: unknown): string | null => (v === undefined ? null : JSON.stringify(v));

export interface RecordArgs {
  checklistId: string;
  actor: EditActor;
  /** The checklist version this save produced. */
  version: number;
  events: DraftEvent[];
  /** For tests. */
  now?: number;
}

/** Inserts (or merges) the events in ONE statement. Throws on database errors; use `recordEditEventsSafely` in routes. */
export async function recordEditEvents(args: RecordArgs): Promise<number> {
  const { checklistId, actor, version, events } = args;
  if (events.length === 0) return 0;
  const now = args.now ?? Date.now();

  // One statement cannot touch the same row twice, so lines that share a key are folded into the last one.
  const byKey = new Map<string, { e: DraftEvent; key: string }>();
  for (const e of events) {
    const key = coalesceKeyFor(actor, e, now);
    byKey.set(key, { e, key });
  }

  const rows = Array.from(byKey.values()).map(
    ({ e, key }) => Prisma.sql`(
      ${randomUUID()}, ${checklistId}, ${actor.linkId ?? null}, ${actor.type}, ${actor.name},
      ${e.tabKey}, ${e.tabLabel}, ${e.rowId}, ${e.rowLabel}, ${e.fieldKey}, ${e.fieldLabel},
      ${e.changeType}, ${e.summary}, ${jsonOrNull(e.before)}::jsonb, ${jsonOrNull(e.after)}::jsonb, ${e.truncated},
      ${version}, ${key}, (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC')
    )`
  );

  await prisma.$executeRaw`
    INSERT INTO "ChecklistEditEvent" (
      "id", "checklistId", "linkId", "actorType", "actorName",
      "tabKey", "tabLabel", "rowId", "rowLabel", "fieldKey", "fieldLabel",
      "changeType", "summary", "before", "after", "truncated",
      "checklistVersion", "coalesceKey", "createdAt", "updatedAt"
    ) VALUES ${Prisma.join(rows)}
    ON CONFLICT ("checklistId", "coalesceKey") DO UPDATE SET
      "after" = EXCLUDED."after",
      "summary" = EXCLUDED."summary",
      "truncated" = EXCLUDED."truncated" OR "ChecklistEditEvent"."truncated",
      "checklistVersion" = EXCLUDED."checklistVersion",
      "updatedAt" = EXCLUDED."updatedAt"
    WHERE "ChecklistEditEvent"."checklistVersion" < EXCLUDED."checklistVersion"`;
  return rows.length;
}

export async function recordEditEventsSafely(args: RecordArgs): Promise<void> {
  try {
    await recordEditEvents(args);
  } catch (err) {
    console.error("[edit-history] could not record", args.events.length, "events for", args.checklistId, err instanceof Error ? err.message : err);
  }
}

export interface SaveRecord {
  checklistId: string;
  actor: EditActor;
  version: number;
  /** The saved values of the changed fields, read under the save's lock BEFORE it was applied. */
  before: Record<string, unknown>;
  /** The request body. */
  after: Record<string, unknown>;
  fields: readonly string[];
  /** Lines to record in front of the itemised changes (for example "Restored the snapshot ..."). */
  leadEvents?: DraftEvent[];
}

/**
 * After a field-level save has committed: work out what changed and record it, and note that a named link was used.
 * The comparison (CPU) happens here, after the response, not in the save.
 */
export function scheduleSaveRecord(save: SaveRecord): void {
  runAfterResponse(async () => {
    if (save.actor.linkId) await touchEditLink(save.actor.linkId);
    const events = [...(save.leadEvents ?? []), ...diffChecklistFields({ before: save.before, after: save.after, fields: save.fields })];
    await recordEditEventsSafely({ checklistId: save.checklistId, actor: save.actor, version: save.version, events });
  });
}

/** After a save that sent the whole document: one honest, coarse line. */
export function scheduleWholeDocumentRecord(p: { checklistId: string; actor: EditActor; version: number; fieldCount: number }): void {
  runAfterResponse(async () => {
    if (p.actor.linkId) await touchEditLink(p.actor.linkId);
    await recordEditEventsSafely({ checklistId: p.checklistId, actor: p.actor, version: p.version, events: [wholeDocumentEvent(p.fieldCount)] });
  });
}

/** Records ready-made lines (a restore, a Claude change). */
export function scheduleEvents(p: { checklistId: string; actor: EditActor; version: number; events: DraftEvent[] }): void {
  runAfterResponse(async () => {
    await recordEditEventsSafely(p);
  });
}
