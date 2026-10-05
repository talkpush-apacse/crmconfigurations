import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { badRequest, notFound } from "./errors";
import { generateShareToken, hashShareToken, linkProblem, looksLikeShareToken, tokenMatchesHash } from "./share-token";
import { shareLinkCreateSchema } from "./validations";

function serializeLink(l: {
  id: string;
  kind: string;
  label: string | null;
  tokenHint: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  personId?: string | null;
  person?: { name: string } | null;
}) {
  return {
    id: l.id,
    kind: l.kind,
    personId: l.personId ?? null,
    contact: l.person?.name ?? null,
    label: l.label,
    hint: l.tokenHint,
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
    revokedAt: l.revokedAt ? l.revokedAt.toISOString() : null,
    lastUsedAt: l.lastUsedAt ? l.lastUsedAt.toISOString() : null,
    createdBy: l.createdBy,
    createdAt: l.createdAt.toISOString(),
    active: !l.revokedAt && (!l.expiresAt || l.expiresAt.getTime() > Date.now()),
  };
}

export async function listShareLinks(projectId: string) {
  const exists = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) throw notFound("Project");
  const links = await prisma.trackerShareLink.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, include: { person: { select: { name: true } } } });
  return links.map(serializeLink);
}

/** Creates a viewer link. The raw token is returned ONCE here and can never be recovered afterwards. */
export async function createViewerLink(projectId: string, input: unknown, actor: Actor) {
  const data = shareLinkCreateSchema.parse(input);
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, archived: true } });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");

  const { token, hash, hint } = generateShareToken();
  const expiresAt = data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null;
  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.trackerShareLink.create({
      data: { projectId, kind: "viewer", label: data.label ?? null, tokenHash: hash, tokenHint: hint, expiresAt, createdBy: actor.label },
    });
    await logActivity(tx, {
      projectId,
      entityType: "project",
      entityId: projectId,
      action: "share.created",
      after: { label: created.label, expiresAt: expiresAt ? expiresAt.toISOString() : null },
      actor,
    });
    return created;
  });
  return { ...serializeLink(link), token };
}

export async function revokeShareLink(linkId: string, actor: Actor) {
  const link = await prisma.trackerShareLink.findUnique({ where: { id: linkId } });
  if (!link) throw notFound("Link");
  if (link.revokedAt) return serializeLink(link);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.trackerShareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } });
    await logActivity(tx, {
      projectId: link.projectId,
      entityType: "project",
      entityId: link.projectId,
      action: "share.revoked",
      after: { label: link.label },
      actor,
    });
    return u;
  });
  return serializeLink(updated);
}

/**
 * For the future public route: resolve a presented token to a project id, or
 * null for ANY problem (malformed, unknown, revoked, expired). The caller must
 * answer null with the same generic 404 so a bad link reveals nothing.
 */
export async function resolveViewerToken(token: string): Promise<string | null> {
  if (!looksLikeShareToken(token)) return null;
  const link = await prisma.trackerShareLink.findUnique({ where: { tokenHash: hashShareToken(token) } });
  if (!link || !tokenMatchesHash(token, link.tokenHash)) return null;
  if (linkProblem(link, "viewer") !== null) return null;
  const project = await prisma.trackerProject.findUnique({ where: { id: link.projectId }, select: { archived: true } });
  if (!project || project.archived) return null;
  // Best-effort, throttled to once a minute so a busy link does not write on every view.
  if (!link.lastUsedAt || Date.now() - link.lastUsedAt.getTime() > 60_000) {
    void prisma.trackerShareLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return link.projectId;
}
