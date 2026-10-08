import "server-only";

import { prisma } from "@/lib/db";
import { findFullChecklistByEditorToken, touchEditLink } from "@/lib/edit-history/resolve";
import { runAfterResponse } from "@/lib/edit-history/record";
import type { ChecklistData } from "@/lib/types";
import { omitInternalConfigForSlug, omitInternalConfigForToken } from "./checklist-public";

/**
 * Loads a checklist for the server-rendered client and editor pages, so the first response already carries the
 * data instead of the browser loading an empty page and then asking for it. Returns exactly what the public
 * GET routes return (same stripping, same JSON shape: dates as ISO strings), or null when there is no match.
 */
function toPublicJson(row: Record<string, unknown>): ChecklistData {
  return JSON.parse(JSON.stringify(row)) as ChecklistData;
}

export async function loadPublicChecklistBySlug(slug: string): Promise<ChecklistData | null> {
  const row = await prisma.checklist.findUnique({ where: { slug } });
  if (!row) return null;
  return toPublicJson(omitInternalConfigForSlug(row as unknown as Record<string, unknown>));
}

/**
 * The editor page's data. `editingAs` is the person's name for a named link (shown as "Editing as ..."), and null for
 * the original shared link. A turned-off or expired link returns null, like an unknown one: the page then asks the
 * API, which answers with the "this link has been turned off" message.
 */
export async function loadPublicChecklistByToken(token: string): Promise<ChecklistData | null> {
  const found = await findFullChecklistByEditorToken(token);
  if (!found.ok) return null;
  // Opening the editor counts as using the link (throttled to once per 10 minutes in the database).
  if (found.actor.linkId) {
    const linkId = found.actor.linkId;
    runAfterResponse(() => touchEditLink(linkId));
  }
  const body = omitInternalConfigForToken(found.checklist as unknown as Record<string, unknown>);
  return toPublicJson({ ...body, editingAs: found.actor.type === "link" ? found.actor.name : null });
}
