import "server-only";

import { prisma } from "@/lib/db";
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

export async function loadPublicChecklistByToken(token: string): Promise<ChecklistData | null> {
  const row = await prisma.checklist.findUnique({ where: { editorToken: token } });
  if (!row) return null;
  return toPublicJson(omitInternalConfigForToken(row as unknown as Record<string, unknown>));
}
