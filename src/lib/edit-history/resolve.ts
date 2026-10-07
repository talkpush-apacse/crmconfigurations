import type { Checklist, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { LEGACY_ACTOR, type EditActor } from "./types";
import { looksLikeEditLinkToken } from "./tokens";

/**
 * The one place that turns a link token from a URL into "which checklist, and who is this".
 *
 * Two kinds of token reach the editor:
 *   - `cel_...`  a named link (one person). Can be turned off or expire.
 *   - a UUID     the original shared link, Checklist.editorToken. Keeps working until staff regenerate it.
 * The kind is told from the shape of the text, so each token costs exactly ONE database round trip.
 *
 * Every route that accepts a token must come through here. If one is missed, a turned-off link would still work there.
 */

export type TokenFailure = "unknown" | "revoked" | "expired";

export type EditorLookup<T> =
  | { ok: true; checklist: T; actor: EditActor }
  | { ok: false; reason: TokenFailure };

async function lookup<Row>(token: string, select: Prisma.ChecklistSelect | undefined): Promise<EditorLookup<Row>> {
  if (typeof token !== "string" || token.length === 0 || token.length > 200) return { ok: false, reason: "unknown" };

  if (looksLikeEditLinkToken(token)) {
    const args = {
      where: { token },
      select: { id: true, name: true, revokedAt: true, expiresAt: true, checklist: select ? { select } : true },
    } as unknown as Prisma.ChecklistEditLinkFindUniqueArgs;
    const link = (await prisma.checklistEditLink.findUnique(args)) as unknown as {
      id: string;
      name: string;
      revokedAt: Date | null;
      expiresAt: Date | null;
      checklist: Row;
    } | null;
    if (!link) return { ok: false, reason: "unknown" };
    if (link.revokedAt) return { ok: false, reason: "revoked" };
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
    return { ok: true, checklist: link.checklist, actor: { type: "link", name: link.name, linkId: link.id } };
  }

  const checklist = (await prisma.checklist.findUnique({
    where: { editorToken: token },
    ...(select ? { select } : {}),
  } as unknown as Prisma.ChecklistFindUniqueArgs)) as unknown as Row | null;
  if (!checklist) return { ok: false, reason: "unknown" };
  return { ok: true, checklist, actor: LEGACY_ACTOR };
}

/** Only the columns asked for. */
export function findChecklistByEditorToken<S extends Prisma.ChecklistSelect>(
  token: string,
  select: S
): Promise<EditorLookup<Prisma.ChecklistGetPayload<{ select: S }>>> {
  return lookup(token, select);
}

/** The whole row (the editor's page data). */
export function findFullChecklistByEditorToken(token: string): Promise<EditorLookup<Checklist>> {
  return lookup(token, undefined);
}

/**
 * Notes that a named link was used. One statement, throttled by the database itself (at most once every 10 minutes
 * per link, across all servers), so a busy editor adds almost no work. Never throws.
 */
export async function touchEditLink(linkId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "ChecklistEditLink"
      SET "lastUsedAt" = (now() AT TIME ZONE 'UTC'),
          "firstOpenedAt" = COALESCE("firstOpenedAt", (now() AT TIME ZONE 'UTC'))
      WHERE "id" = ${linkId}
        AND ("lastUsedAt" IS NULL OR "lastUsedAt" < (now() AT TIME ZONE 'UTC') - interval '10 minutes')`;
  } catch (err) {
    console.error("[edit-history] could not note link use:", err instanceof Error ? err.message : err);
  }
}
