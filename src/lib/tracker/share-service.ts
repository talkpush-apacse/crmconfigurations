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

/** Links made through the Claude connector carry this label, so a new one can replace the old one without touching links made by hand. */
export const CONNECTOR_LINK_LABEL = "Client link (via Claude)";
const CONNECTOR_DEFAULT_DAYS = 90;
const CONNECTOR_MAX_DAYS = 365;

/** An expiry the connector may set: a date or date-time in the future, within a year. Omitted = 90 days; null = never. */
export function resolveConnectorExpiry(value: string | null | undefined, now = new Date()): Date | null {
  if (value === null) return null;
  if (value === undefined || value.trim() === "") return new Date(now.getTime() + CONNECTOR_DEFAULT_DAYS * 86_400_000);
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw badRequest("Use a real date for the expiry, for example 2026-12-31.");
  if (when.getTime() <= now.getTime()) throw badRequest("The expiry must be in the future.");
  if (when.getTime() > now.getTime() + CONNECTOR_MAX_DAYS * 86_400_000) throw badRequest("A client link can last at most a year. Choose an earlier expiry.");
  return when;
}

/**
 * Creates the client view link for the Claude connector, replacing the one the connector made before.
 * Links staff made by hand in the Share dialog are left alone. The raw token is returned ONCE.
 */
export async function replaceConnectorViewerLink(projectId: string, expiresAt: Date | null, actor: Actor) {
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, archived: true } });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");

  const { token, hash, hint } = generateShareToken();
  const result = await prisma.$transaction(async (tx) => {
    const old = await tx.trackerShareLink.findMany({ where: { projectId, kind: "viewer", label: CONNECTOR_LINK_LABEL, revokedAt: null } });
    if (old.length > 0) {
      await tx.trackerShareLink.updateMany({ where: { id: { in: old.map((l) => l.id) } }, data: { revokedAt: new Date() } });
      await logActivity(tx, {
        projectId,
        entityType: "project",
        entityId: projectId,
        action: "share.revoked",
        after: { label: CONNECTOR_LINK_LABEL, replacedBy: "a new link", count: old.length },
        actor,
      });
    }
    const created = await tx.trackerShareLink.create({
      data: { projectId, kind: "viewer", label: CONNECTOR_LINK_LABEL, tokenHash: hash, tokenHint: hint, expiresAt, createdBy: actor.label },
    });
    await logActivity(tx, {
      projectId,
      entityType: "project",
      entityId: projectId,
      action: "share.created",
      after: { label: created.label, level: "view", expiresAt: expiresAt ? expiresAt.toISOString() : null },
      actor,
    });
    return { created, replaced: old.length };
  });
  return { ...serializeLink(result.created), token, replaced: result.replaced };
}

/** Turns one link off, but only if it belongs to this project (a link id from another project is "not found"). */
export async function revokeProjectLink(projectId: string, linkId: string, actor: Actor) {
  const link = await prisma.trackerShareLink.findFirst({ where: { id: linkId, projectId }, select: { id: true } });
  if (!link) throw notFound("Link");
  return revokeShareLink(link.id, actor);
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
