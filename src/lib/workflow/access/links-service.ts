import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "./errors";
import { recordAudit } from "./audit";
import { defaultsForLevel } from "./permissions";
import { generateToken, hashPasscode } from "./tokens";

/**
 * Staff-only management of who can open a workflow: the three shared links (view, comment, edit) and named
 * invites. The secret link itself is returned ONCE, when it is created or replaced; after that only a short
 * hint is kept, because only a hash is stored. To get a link again, replace it ("Get a new link").
 */

const expiry = z
  .union([z.string().datetime({ offset: true }), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : v === null ? null : undefined));

export const linkCreateSchema = z.object({
  level: z.enum(["view", "comment", "edit"]),
  editMode: z.enum(["direct", "suggest_only"]).optional(),
  canApprove: z.boolean().optional(),
  passcode: z.string().min(4).max(64).nullable().optional(),
  expiresAt: expiry,
});
export type LinkCreateInput = z.infer<typeof linkCreateSchema>;

export const linkUpdateSchema = z.object({
  editMode: z.enum(["direct", "suggest_only"]).optional(),
  canApprove: z.boolean().optional(),
  passcode: z.string().min(4).max(64).nullable().optional(), // null removes the passcode
  expiresAt: expiry,
});

export const memberCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120).optional(),
  level: z.enum(["viewer", "commenter", "editor"]),
  editMode: z.enum(["direct", "suggest_only"]).optional(),
  canApprove: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canAcceptSuggestions: z.boolean().optional(),
  expiresAt: expiry,
});

export const memberUpdateSchema = memberCreateSchema.partial().omit({ displayName: true, email: true }).extend({
  displayName: z.string().trim().min(1).max(80).optional(),
});

/** Edit links and edit invites start in suggest-only mode with a 30-day expiry (Jolo's choice, D11). */
export const EDIT_LINK_DEFAULT_DAYS = 30;
const DAY_MS = 86_400_000;

export interface AccessOverview {
  generalAccess: string;
  showFeasibility: boolean;
  publishedVersionId: string | null;
  links: LinkSummary[];
  members: MemberSummary[];
}

export interface LinkSummary {
  id: string;
  level: string;
  editMode: string;
  canApprove: boolean;
  hasPasscode: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  hint: string | null;
  createdAt: Date;
}

export interface MemberSummary {
  id: string;
  displayName: string;
  email: string | null;
  level: string;
  editMode: string;
  canApprove: boolean;
  canComment: boolean;
  canAcceptSuggestions: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  firstOpenedAt: Date | null;
  lastSeenAt: Date | null;
  hint: string | null;
  createdAt: Date;
}

export async function getAccessOverview(workflowId: string): Promise<AccessOverview> {
  const workflow = await prisma.workflowProject.findUnique({
    where: { id: workflowId },
    select: { generalAccess: true, showFeasibility: true, publishedVersionId: true },
  });
  if (!workflow) throw notFound("Workflow");
  const [links, members] = await Promise.all([
    // Only links that are still switched on; a replaced or turned-off link is history, not a row to manage.
    prisma.workflowLink.findMany({ where: { workflowId, disabledAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.workflowMember.findMany({ where: { workflowId, revokedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    ...workflow,
    links: links.map((l) => ({
      id: l.id,
      level: l.level,
      editMode: l.editMode,
      canApprove: l.canApprove,
      hasPasscode: Boolean(l.passcodeHash),
      expiresAt: l.expiresAt,
      lastUsedAt: l.lastUsedAt,
      hint: l.tokenHint,
      createdAt: l.createdAt,
    })),
    members: members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      email: m.email,
      level: m.level,
      editMode: m.editMode,
      canApprove: m.canApprove,
      canComment: m.canComment,
      canAcceptSuggestions: m.canAcceptSuggestions,
      expiresAt: m.expiresAt,
      revokedAt: m.revokedAt,
      firstOpenedAt: m.firstOpenedAt,
      lastSeenAt: m.lastSeenAt,
      hint: m.tokenHint,
      createdAt: m.createdAt,
    })),
  };
}

export async function updateGeneralSettings(
  workflowId: string,
  adminId: string,
  patch: { generalAccess?: "restricted" | "anyone_with_link"; showFeasibility?: boolean }
) {
  const data: { generalAccess?: string; showFeasibility?: boolean } = {};
  if (patch.generalAccess) data.generalAccess = patch.generalAccess;
  if (patch.showFeasibility !== undefined) data.showFeasibility = patch.showFeasibility;
  const updated = await prisma.workflowProject.update({
    where: { id: workflowId },
    data,
    select: { generalAccess: true, showFeasibility: true },
  });
  await recordAudit({ workflowId, actorType: "admin", actorId: adminId, action: "access.settings_changed", detail: data });
  return updated;
}

function applyEditDefaults(level: string, input: { editMode?: string; expiresAt?: Date | null | undefined }) {
  const isEdit = level === "edit" || level === "editor";
  const editMode = isEdit ? (input.editMode ?? "suggest_only") : "direct";
  const expiresAt =
    input.expiresAt !== undefined ? input.expiresAt : isEdit ? new Date(Date.now() + EDIT_LINK_DEFAULT_DAYS * DAY_MS) : null;
  return { editMode, expiresAt };
}

/** Creates a shared link and switches general access to "anyone with the link" if it was off. Returns the secret once. */
export async function createLink(workflowId: string, adminId: string, input: LinkCreateInput) {
  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { id: true } });
  if (!workflow) throw notFound("Workflow");
  // One live link per level: creating again replaces the old one (same as "Get a new link").
  const existing = await prisma.workflowLink.findFirst({ where: { workflowId, level: input.level, disabledAt: null } });
  if (existing) await prisma.workflowLink.update({ where: { id: existing.id }, data: { disabledAt: new Date() } });

  const { editMode, expiresAt } = applyEditDefaults(input.level, input);
  const secret = generateToken("link");
  const row = await prisma.workflowLink.create({
    data: {
      workflowId,
      level: input.level,
      editMode,
      canApprove: input.canApprove ?? false,
      tokenHash: secret.hash,
      tokenHint: secret.hint,
      passcodeHash: input.passcode ? hashPasscode(input.passcode) : null,
      expiresAt,
      createdByAdminId: adminId,
    },
  });
  await prisma.workflowProject.update({ where: { id: workflowId }, data: { generalAccess: "anyone_with_link" } });
  await recordAudit({
    workflowId,
    actorType: "admin",
    actorId: adminId,
    action: existing ? "link.rotated" : "link.created",
    detail: { linkId: row.id, level: input.level, editMode, expiresAt, passcode: Boolean(input.passcode) },
  });
  return { id: row.id, token: secret.token, level: row.level, editMode: row.editMode, expiresAt: row.expiresAt };
}

export async function updateLink(workflowId: string, adminId: string, linkId: string, patch: z.infer<typeof linkUpdateSchema>) {
  const link = await prisma.workflowLink.findFirst({ where: { id: linkId, workflowId, disabledAt: null } });
  if (!link) throw notFound("Link");
  if (patch.editMode && link.level !== "edit") throw badRequest("Only an edit link has an editing mode.");
  await prisma.workflowLink.update({
    where: { id: linkId },
    data: {
      ...(patch.editMode ? { editMode: patch.editMode } : {}),
      ...(patch.canApprove !== undefined ? { canApprove: patch.canApprove } : {}),
      ...(patch.passcode !== undefined ? { passcodeHash: patch.passcode ? hashPasscode(patch.passcode) : null } : {}),
      ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
    },
  });
  await recordAudit({
    workflowId,
    actorType: "admin",
    actorId: adminId,
    action: "link.updated",
    detail: { linkId, ...patch, passcode: patch.passcode === undefined ? undefined : Boolean(patch.passcode) },
  });
}

/** Turns a shared link off. The address stops working at once. */
export async function disableLink(workflowId: string, adminId: string, linkId: string) {
  const link = await prisma.workflowLink.findFirst({ where: { id: linkId, workflowId, disabledAt: null } });
  if (!link) throw notFound("Link");
  await prisma.workflowLink.update({ where: { id: linkId }, data: { disabledAt: new Date() } });
  await recordAudit({ workflowId, actorType: "admin", actorId: adminId, action: "link.disabled", detail: { linkId, level: link.level } });
}

/** Invites one named person. Returns their personal secret link once. */
export async function createMember(workflowId: string, adminId: string, input: z.infer<typeof memberCreateSchema>) {
  const workflow = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { id: true } });
  if (!workflow) throw notFound("Workflow");
  const defaults = defaultsForLevel(input.level);
  const { editMode, expiresAt } = applyEditDefaults(input.level, input);
  const secret = generateToken("member");
  const row = await prisma.workflowMember.create({
    data: {
      workflowId,
      level: input.level,
      editMode,
      displayName: input.displayName,
      email: input.email ?? null,
      canApprove: input.canApprove ?? defaults.canApprove,
      canComment: input.canComment ?? defaults.canComment,
      canAcceptSuggestions: input.level === "editor" ? (input.canAcceptSuggestions ?? false) : false,
      tokenHash: secret.hash,
      tokenHint: secret.hint,
      expiresAt,
      createdByAdminId: adminId,
    },
  });
  await recordAudit({
    workflowId,
    actorType: "admin",
    actorId: adminId,
    action: "member.invited",
    detail: { memberId: row.id, displayName: row.displayName, level: row.level, editMode, expiresAt },
  });
  return { id: row.id, token: secret.token, displayName: row.displayName, level: row.level, expiresAt: row.expiresAt };
}

export async function updateMember(workflowId: string, adminId: string, memberId: string, patch: z.infer<typeof memberUpdateSchema>) {
  const member = await prisma.workflowMember.findFirst({ where: { id: memberId, workflowId, revokedAt: null } });
  if (!member) throw notFound("Person");
  const level = patch.level ?? member.level;
  await prisma.workflowMember.update({
    where: { id: memberId },
    data: {
      ...(patch.displayName ? { displayName: patch.displayName } : {}),
      ...(patch.level ? { level: patch.level } : {}),
      ...(patch.editMode ? { editMode: patch.editMode } : {}),
      ...(patch.canApprove !== undefined ? { canApprove: patch.canApprove } : {}),
      ...(patch.canComment !== undefined ? { canComment: patch.canComment } : {}),
      ...(patch.canAcceptSuggestions !== undefined ? { canAcceptSuggestions: level === "editor" && patch.canAcceptSuggestions } : {}),
      ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
    },
  });
  await recordAudit({ workflowId, actorType: "admin", actorId: adminId, action: "member.updated", detail: { memberId, ...patch } });
}

/** Removes a person's access. Their link stops working on their next request. */
export async function revokeMember(workflowId: string, adminId: string, memberId: string) {
  const member = await prisma.workflowMember.findFirst({ where: { id: memberId, workflowId, revokedAt: null } });
  if (!member) throw notFound("Person");
  await prisma.workflowMember.update({ where: { id: memberId }, data: { revokedAt: new Date() } });
  await recordAudit({ workflowId, actorType: "admin", actorId: adminId, action: "member.revoked", detail: { memberId, displayName: member.displayName } });
}

/** Replaces a person's secret link with a new one (the old address dies). Returns the new secret once. */
export async function rotateMember(workflowId: string, adminId: string, memberId: string) {
  const member = await prisma.workflowMember.findFirst({ where: { id: memberId, workflowId, revokedAt: null } });
  if (!member) throw notFound("Person");
  const secret = generateToken("member");
  await prisma.workflowMember.update({ where: { id: memberId }, data: { tokenHash: secret.hash, tokenHint: secret.hint } });
  await recordAudit({ workflowId, actorType: "admin", actorId: adminId, action: "member.link_replaced", detail: { memberId, displayName: member.displayName } });
  return { id: memberId, token: secret.token, displayName: member.displayName };
}
