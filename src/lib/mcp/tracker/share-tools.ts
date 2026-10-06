/**
 * Project Tracker tools for sharing a project with a client. Same rules as the Share dialog on the website:
 * the link opens the client view only (client-visible items and shared remarks, never internal items,
 * team-only remarks or Jira links), the secret address is shown once, and nothing is ever emailed.
 */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { prisma } from "@/lib/db";
import { clientPageUrl, clientViewUrl, hostWarning, resolveClientLinkBase } from "@/lib/tracker/client-link-url";
import { issueContributorLink } from "@/lib/tracker/contributor-service";
import { badRequest } from "@/lib/tracker/errors";
import { matchByName } from "@/lib/tracker/match";
import { listShareLinks, replaceConnectorViewerLink, resolveConnectorExpiry, revokeProjectLink } from "@/lib/tracker/share-service";
import { pick, projectRef, resolveProjectId } from "./helpers";

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
    level: z.enum(["view"]).describe("Only a view-only link for the whole project. To give one named client contact access, use invite_project_person."),
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

export const inviteProjectPersonTool = defineTool({
  name: "invite_project_person",
  description:
    "Give one named client contact their own link to a project and return the address for the user to copy and send themselves; nothing is emailed. " +
    "The person must already be a client contact on the project's account (use create_person first if they are not). " +
    "level viewer = Client View Only: the read-only client view and its Activity tab. level editor = Client Contributor: they see the client view and may (a) edit any item they can see (title, details, status to not started, in progress, waiting on client or done, priority, dates, who looks after it among client contacts, and what it waits for), " +
    "(b) comment on any item they can see, and (c) add new items, which wait for staff review. Every change is recorded under their name in the Activity trail that all client links can read. They can never see internal items, set an item to blocked or dropped, change blocked or dropped items' status, or change anything else. " +
    "Calling it again for the same person and level replaces their earlier connector link, whose address stops working at once. The address is shown once." +
    EXPLICIT,
  access: "write",
  input: {
    ...projectRef,
    display_name: z.string().describe("The contact's name, as in list_people for the project's account"),
    email: z.string().optional().describe("Only used to tell two people with the same name apart and to check it is the right person. Nothing is sent to it."),
    level: z.enum(["viewer", "editor"]),
    expires_at: z
      .string()
      .nullable()
      .optional()
      .describe("Date or date-time the link stops working (within a year). Leave out for 90 days. Editor links always expire; null is only allowed for viewer."),
    assign_unassigned_plan_items: z
      .boolean()
      .optional()
      .describe("Editor only. Also hand this person every unassigned 'client does this' item from the standard plan. Default false. Changes who owns those items."),
  },
  handler: async ({ display_name, email, level, expires_at, assign_unassigned_plan_items, ...ref }, ctx) => {
    const projectId = await resolveProjectId(ref);
    if (level === "editor" && expires_at === null) throw badRequest("An editor link must have an expiry. Leave expires_at out for 90 days, or give a date.");
    if (level === "viewer" && assign_unassigned_plan_items) throw badRequest("Only an editor can be given items.");

    const project = await prisma.trackerProject.findUniqueOrThrow({ where: { id: projectId }, select: { accountId: true, account: { select: { name: true } } } });
    const contacts = await prisma.trackerPerson.findMany({
      where: { accountId: project.accountId, side: "client", archived: false },
      select: { id: true, name: true, email: true, title: true },
    });
    const pool = email ? contacts.filter((c) => !c.email || c.email.toLowerCase() === email.trim().toLowerCase()) : contacts;
    const found = matchByName(pool, display_name, (c) => c.name);
    if (found.kind === "none") {
      const known = contacts.map((c) => c.name).join(", ") || "none yet";
      throw badRequest(
        `No client contact named "${display_name}"${email ? ` with that email` : ""} on ${project.account.name}. Client contacts there: ${known}. ` +
          "Add them with create_person first, then try again."
      );
    }
    const person = pick(found, "client contact", display_name, (c) => `${c.name}${c.title ? `, ${c.title}` : ""} (${c.id})`);

    let base;
    try {
      base = resolveClientLinkBase(ctx.origin);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Could not work out the link address.");
    }
    const expiresAt = resolveConnectorExpiry(expires_at);
    const warning = hostWarning(base);
    const common = { personId: person.id, displayName: person.name, host: base.host, ...(warning ? { warning } : {}) };

    if (level === "viewer") {
      const link = await replaceConnectorViewerLink(projectId, expiresAt, ctx.actor, { id: person.id, name: person.name });
      return {
        ...common,
        level: "viewer",
        linkId: link.id,
        url: clientViewUrl(base, link.token),
        expiresAt: link.expiresAt,
        replacedEarlierLink: link.replaced > 0,
        note: "Nothing is emailed. Give this address to the person to copy and send themselves. It is shown once.",
      };
    }

    const link = await issueContributorLink(
      projectId,
      {
        personId: person.id,
        label: `${person.name} (editor, via Claude)`,
        expiresAt: expiresAt as Date,
        assignUnassigned: assign_unassigned_plan_items ?? false,
        replaceSameLabel: true,
      },
      ctx.actor
    );
    return {
      ...common,
      level: "editor",
      linkId: link.id,
      url: clientPageUrl(base, "contribute", link.token),
      expiresAt: link.expiresAt,
      replacedEarlierLink: link.replaced > 0,
      itemsAssigned: link.itemsAssigned,
      canDo: "Edit any item they can see, comment on any item, add their own items (staff review them). Every change shows in the Activity trail under their name. Never internal items, and never blocked or dropped statuses.",
      note:
        "Nothing is emailed. Give this address to the person to copy and send themselves. It is shown once." +
        (link.itemsAssigned === 0 ? " Nothing is assigned to them yet. They can still edit any item, but you can assign items to them (update_item) or invite again with assign_unassigned_plan_items." : ""),
    };
  },
});

export const listProjectAccessTool = defineTool({
  name: "list_project_access",
  description:
    "Who can open a project through a shared link: each link's label, expiry, last time it was opened and whether it still works. " +
    "Secret addresses are never listed (only a short hint to tell links apart). Links turned off are not shown. " +
    "A link with a person is that client contact's personal link; level edit means they can update their own items.",
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
        level: l.kind === "viewer" ? "view" : l.kind === "contributor" ? "edit" : l.kind,
        person: l.contact,
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
export const trackerShareWriteTools = [createProjectLinkTool, inviteProjectPersonTool, disableProjectLinkTool];
