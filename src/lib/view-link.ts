import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * The read-only "can view" link for a checklist: /view/<token>.
 *
 * One token per checklist, stored on the checklist itself. Turning it off clears the token, so the old address
 * stops working at once; "new address" swaps it for a fresh one. Anyone holding the current address can read
 * the checklist (the client slice, see omitInternalConfigForView) and can change nothing.
 */

/** 192 random bits as URL-safe text (32 characters). Unguessable, so the address itself is the key. */
export function newViewToken(): string {
  return randomBytes(24).toString("base64url");
}

type Result = { ok: true; token: string | null } | { ok: false; reason: "not_found" };

async function exists(checklistId: string): Promise<boolean> {
  const row = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { id: true } });
  return !!row;
}

/** The current view token, or null when no view link is on. */
export async function getViewLink(checklistId: string): Promise<Result> {
  const row = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { viewToken: true } });
  return row ? { ok: true, token: row.viewToken } : { ok: false, reason: "not_found" };
}

/** Turns the link on. If it is already on, the existing address is kept (so copying again never breaks a sent link). */
export async function enableViewLink(checklistId: string): Promise<Result> {
  if (!(await exists(checklistId))) return { ok: false, reason: "not_found" };
  // Only fills it when empty, so two staff clicking at once cannot swap an address someone just copied.
  await prisma.checklist.updateMany({ where: { id: checklistId, viewToken: null }, data: { viewToken: newViewToken() } });
  return getViewLink(checklistId);
}

/** Gives the link a new address. The old one stops working at once. */
export async function regenerateViewLink(checklistId: string): Promise<Result> {
  if (!(await exists(checklistId))) return { ok: false, reason: "not_found" };
  await prisma.checklist.update({ where: { id: checklistId }, data: { viewToken: newViewToken() } });
  return getViewLink(checklistId);
}

/** Turns the link off. The address stops working at once; turning it on again makes a new one. */
export async function disableViewLink(checklistId: string): Promise<Result> {
  if (!(await exists(checklistId))) return { ok: false, reason: "not_found" };
  await prisma.checklist.update({ where: { id: checklistId }, data: { viewToken: null } });
  return { ok: true, token: null };
}
