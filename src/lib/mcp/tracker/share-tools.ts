/**
 * Project Tracker tools for sharing a project with a client. Same rules as the Share dialog on the website:
 * the link opens the client view only (client-visible items and shared remarks, never internal items,
 * team-only remarks or Jira links), the secret address is shown once, and nothing is ever emailed.
 */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { prisma } from "@/lib/db";
import { clientViewUrl, hostWarning, resolveClientLinkBase } from "@/lib/tracker/client-link-url";
import { badRequest } from "@/lib/tracker/errors";
import { listShareLinks, replaceConnectorViewerLink, resolveConnectorExpiry, revokeProjectLink } from "@/lib/tracker/share-service";
import { projectRef, resolveProjectId } from "./helpers";

const EXPLICIT = " Only use this when the user explicitly asks for it.";

export const createProjectLinkTool = defineTool({
  name: "create_project_link",
  description:
    "Create (or replace) the client view link for a project and return its address for the user to copy and send themselves; nothing is emailed. " +
    "The link opens a read-only page with client-visible items only (never internal items or Jira links). " +
    "Replaces the link this tool made before, whose address stops working at once; links made by hand in the Share dialog are left alone. " +
    "The address is shown once and cannot be fetched again." +
    EXPLICIT,
  access: "write",
  input: {
    ...projectRef,
    level: z.enum(["view"]).describe("Only a view-only link is available in this release."),
    expires_at: z
      .string()
      .nullable()
      .optional()
      .describe("Date or date-time the link stops working (within a year). Leave out for 90 days; null for no expiry."),
  },
  handler: async ({ level, expires_at, ...ref }, ctx) => {
    if (level !== "view") throw badRequest("Only a view-only link is available in this release.");
    const projectId = await resolveProjectId(ref);
    // Work out the address first, so a bad setting is reported before any link exists.
    let base;
    try {
      base = resolveClientLinkBase(ctx.origin);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Could not work out the link address.");
    }
    const expiresAt = resolveConnectorExpiry(expires_at);
    const link = await replaceConnectorViewerLink(projectId, expiresAt, ctx.actor);
    const warning = hostWarning(base);
    return {
      url: clientViewUrl(base, link.token),
      level: "view",
      linkId: link.id,
      expiresAt: link.expiresAt,
      replacedEarlierLink: link.replaced > 0,
      host: base.host,
      ...(warning ? { warning } : {}),
      note: "Give this address to the person to copy and send themselves. It is shown once; creating a new link replaces it and the old address stops working.",
    };
  },
});

export const listProjectAccessTool = defineTool({
  name: "list_project_access",
  description:
    "Who can open a project through a shared link: each link's label, expiry, last time it was opened and whether it still works. " +
    "Secret addresses are never listed (only a short hint to tell links apart). Links turned off are not shown.",
  access: "read",
  input: { ...projectRef },
  handler: async (ref) => {
    const projectId = await resolveProjectId(ref);
    const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { title: true, account: { select: { name: true } } } });
    const links = (await listShareLinks(projectId)).filter((l) => !l.revokedAt);
    return {
      project: project?.title ?? null,
      account: project?.account.name ?? null,
      links: links.map((l) => ({
        id: l.id,
        level: l.kind === "viewer" ? "view" : l.kind,
        label: l.label,
        hint: l.hint,
        active: l.active,
        expiresAt: l.expiresAt,
        lastUsedAt: l.lastUsedAt,
        createdBy: l.createdBy,
        createdAt: l.createdAt,
      })),
    };
  },
});

export const disableProjectLinkTool = defineTool({
  name: "disable_project_link",
  description: "Turn a project's shared link off; its address stops working at once. Get the link_id from list_project_access." + EXPLICIT,
  access: "write",
  input: { ...projectRef, link_id: z.string().describe("Link id from list_project_access") },
  handler: async ({ link_id, ...ref }, ctx) => {
    const projectId = await resolveProjectId(ref);
    await revokeProjectLink(projectId, link_id, ctx.actor);
    return { success: true };
  },
});

export const trackerShareReadTools = [listProjectAccessTool];
export const trackerShareWriteTools = [createProjectLinkTool, disableProjectLinkTool];
