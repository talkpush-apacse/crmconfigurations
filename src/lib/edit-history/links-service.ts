import { prisma } from "@/lib/db";
import { cleanLinkName, generateEditLinkToken } from "./tokens";
import type { EditLinkRow } from "./types";

/**
 * Staff-only management of named edit links. Every call is scoped to one checklist, so a link id from another
 * checklist can never be touched by mistake. A turned-off link is never deleted: it keeps its row (revokedAt) so the
 * history can still name who it was.
 */

export class EditLinkError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const SELECT = {
  id: true, name: true, token: true, createdByLabel: true, createdAt: true,
  firstOpenedAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true,
} as const;

type LinkRecord = {
  id: string; name: string; token: string; createdByLabel: string | null; createdAt: Date;
  firstOpenedAt: Date | null; lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toLinkRow(l: LinkRecord): EditLinkRow {
  return {
    id: l.id, name: l.name, token: l.token, createdByLabel: l.createdByLabel,
    createdAt: l.createdAt.toISOString(), firstOpenedAt: iso(l.firstOpenedAt), lastUsedAt: iso(l.lastUsedAt),
    expiresAt: iso(l.expiresAt), revokedAt: iso(l.revokedAt),
  };
}

export async function listEditLinks(checklistId: string): Promise<EditLinkRow[]> {
  const rows = await prisma.checklistEditLink.findMany({
    where: { checklistId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECT,
  });
  return rows.map(toLinkRow);
}

async function assertNameFree(checklistId: string, name: string, exceptId?: string) {
  const clash = await prisma.checklistEditLink.findFirst({
    where: { checklistId, revokedAt: null, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new EditLinkError(`There is already an active link named "${name}". Use a different name so the history stays clear.`, 409);
}

export async function createEditLink(p: {
  checklistId: string;
  name: unknown;
  createdByLabel?: string | null;
  expiresAt?: Date | null;
}): Promise<EditLinkRow> {
  const name = cleanLinkName(p.name);
  if (!name) throw new EditLinkError("Give the link a name (1 to 80 characters), for example the person's name.", 400);
  const checklist = await prisma.checklist.findUnique({ where: { id: p.checklistId }, select: { id: true } });
  if (!checklist) throw new EditLinkError("Checklist not found", 404);
  await assertNameFree(p.checklistId, name);
  const row = await prisma.checklistEditLink.create({
    data: {
      checklistId: p.checklistId,
      name,
      token: generateEditLinkToken(),
      createdByLabel: p.createdByLabel ?? null,
      expiresAt: p.expiresAt ?? null,
    },
    select: SELECT,
  });
  return toLinkRow(row);
}

async function loadScoped(checklistId: string, linkId: string) {
  const row = await prisma.checklistEditLink.findFirst({ where: { id: linkId, checklistId }, select: SELECT });
  if (!row) throw new EditLinkError("Link not found", 404);
  return row;
}

/** Changing the name affects the history from now on; lines already recorded keep the name they were written with. */
export async function renameEditLink(checklistId: string, linkId: string, rawName: unknown): Promise<EditLinkRow> {
  const name = cleanLinkName(rawName);
  if (!name) throw new EditLinkError("Give the link a name (1 to 80 characters).", 400);
  const current = await loadScoped(checklistId, linkId);
  if (current.revokedAt) throw new EditLinkError("This link is turned off. Create a new link instead.", 409);
  await assertNameFree(checklistId, name, linkId);
  const row = await prisma.checklistEditLink.update({ where: { id: linkId }, data: { name }, select: SELECT });
  return toLinkRow(row);
}

/** A new address for the same person and name. The old address stops working at once; history is kept. */
export async function regenerateEditLink(checklistId: string, linkId: string): Promise<EditLinkRow> {
  const current = await loadScoped(checklistId, linkId);
  if (current.revokedAt) throw new EditLinkError("This link is turned off. Create a new link instead.", 409);
  const row = await prisma.checklistEditLink.update({
    where: { id: linkId },
    data: { token: generateEditLinkToken(), firstOpenedAt: null, lastUsedAt: null },
    select: SELECT,
  });
  return toLinkRow(row);
}

/** Turns a link off at once. Safe to repeat. */
export async function revokeEditLink(checklistId: string, linkId: string): Promise<EditLinkRow> {
  const current = await loadScoped(checklistId, linkId);
  if (current.revokedAt) return toLinkRow(current);
  const row = await prisma.checklistEditLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
    select: SELECT,
  });
  return toLinkRow(row);
}
