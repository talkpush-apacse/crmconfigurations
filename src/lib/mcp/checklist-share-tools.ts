/**
 * CRM Config Checklist tools for sharing a checklist with a client. They do what the Share dialog on the website does:
 *  - Can view: the read-only /view/<token> address (turned on, given a new address, or turned off).
 *  - Can edit: the checklist's original editor address, or a named edit link for one person (their changes show in the
 *    edit history under that name).
 * Both open the tab you ask for, the same way the dialog opens the tab on screen. Nothing is ever emailed: the tool
 * returns the address and the user copies and sends it themselves.
 *
 * The rules (what a view link shows, how an address is made, name checks) live in src/lib/view-link.ts and
 * src/lib/edit-history/links-service.ts, so the website and Claude cannot disagree.
 */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { prisma } from "@/lib/db";
import { EditLinkError, createEditLink, listEditLinks, regenerateEditLink, revokeEditLink } from "@/lib/edit-history/links-service";
import { excludeTalkpushTabs, getEnabledTabs, type TabConfig } from "@/lib/tab-config";
import { parseBaseUrl } from "@/lib/tracker/client-link-url";
import type { CustomTab } from "@/lib/types";

/**
 * view-link.ts is guarded with `server-only`, which refuses to load outside a Next.js build (for example in the tool-list
 * tests). It is loaded when a tool actually runs, so listing the tools never needs it.
 */
const viewLinks = () => import("@/lib/view-link");

/** A problem a person can act on. Its message is shown as it is. */
export class ChecklistToolError extends Error {}

const EXPLICIT = " Only use this when the user explicitly asks for it.";

const slugField = z.string().describe("The checklist URL slug (see list_checklists), for example 'acme-corp'");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function loadChecklist(slug: string) {
  const row = await prisma.checklist.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, clientName: true, editorToken: true, viewToken: true, isCustom: true,
      enabledTabs: true, tabOrder: true, tabFilledBy: true, customTabs: true,
    },
  });
  if (!row) throw new ChecklistToolError(`No checklist with the slug "${slug}". Use list_checklists to see the slugs.`);
  return row;
}

type LoadedChecklist = Awaited<ReturnType<typeof loadChecklist>>;

/** The address links are built on: the one Claude was connected through, the same as the Share dialog uses the page's own address. */
function linkOrigin(origin: string | undefined): string {
  const base = parseBaseUrl(origin);
  if (!base) throw new ChecklistToolError("Could not work out the address to build the link on.");
  return base.origin;
}

function parseExpiry(raw: string | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new ChecklistToolError("expires_at must be a date in the future, for example 2026-12-31.");
  }
  return date;
}

/**
 * Which tab each link opens. The same rules as the Share dialog: the editor link opens any tab the checklist has on;
 * the view link shows what a client sees, so a tab Talkpush fills in opens the start page instead.
 */
function resolveTabs(checklist: LoadedChecklist, tab: string | undefined) {
  if (!tab || checklist.isCustom) return { editSlug: "welcome", viewSlug: "welcome", tabLabel: null as string | null, notes: [] as string[] };
  const customTabs = (checklist.customTabs as CustomTab[] | null) ?? null;
  const filledBy = (checklist.tabFilledBy as Record<string, "talkpush" | "client"> | null) ?? null;
  const enabled = checklist.enabledTabs as string[] | null;
  const order = checklist.tabOrder as string[] | null;
  const editTabs: TabConfig[] = getEnabledTabs(enabled, false, order, customTabs, null);
  const viewTabs: TabConfig[] = excludeTalkpushTabs(getEnabledTabs(enabled, false, order, customTabs, filledBy));

  const wanted = tab.trim().toLowerCase();
  const found = editTabs.find((t) => t.slug === wanted) ?? editTabs.find((t) => t.label.toLowerCase() === wanted);
  if (!found) {
    throw new ChecklistToolError(
      `"${tab}" is not a tab on this checklist. Tabs: ${editTabs.map((t) => `${t.label} (${t.slug})`).join(", ")}.`
    );
  }
  const viewable = viewTabs.some((t) => t.slug === found.slug);
  return {
    editSlug: found.slug,
    viewSlug: viewable ? found.slug : "welcome",
    tabLabel: found.label,
    notes: viewable ? [] : [`${found.label} is filled in by Talkpush, so the view link opens the start page.`],
  };
}

function viewUrl(origin: string, token: string, slug: string): string {
  return `${origin}/view/${token}/${slug}`;
}

function editUrl(origin: string, token: string, slug: string): string {
  return `${origin}/editor/${token}/${slug}`;
}

function linkStatus(l: { revokedAt: string | null; expiresAt: string | null }): "active" | "expired" | "turned off" {
  if (l.revokedAt) return "turned off";
  if (l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

export const createChecklistLinkTool = defineTool({
  name: "create_checklist_link",
  description:
    "Get a client link for a checklist, to copy and send yourself; nothing is emailed. The same two links as the Share button on the website. " +
    "level view = 'Can view': a read-only link that shows what the client sees and changes nothing. It is turned on if it was off; if it is already on, the same address comes back so a link already sent keeps working. " +
    "level edit = 'Can edit': the person can change the checklist. Without a name this is the checklist's original shared edit link (its changes show in the edit history as 'Original shared link'; it can only be replaced from the website's checklist menu, Regenerate original editor link). " +
    "With a name it is a named edit link for that one person: their changes show in the edit history under that name, and it can be turned off or given a new address later. " +
    "Pass tab (a tab name or slug such as 'users') to open that tab; without it the link opens the start page." +
    EXPLICIT,
  access: "write",
  input: {
    slug: slugField,
    level: z.enum(["view", "edit"]).describe("view = read-only; edit = can change the checklist"),
    tab: z.string().optional().describe("Tab to open, by name or slug (for example 'User List' or 'users'). Leave out for the start page."),
    name: z
      .string()
      .optional()
      .describe("Edit only. A person's name (1-80 characters) to make a named edit link that is recorded under that name in the edit history. Leave out for the original shared link."),
    expires_at: z
      .string()
      .optional()
      .describe("Edit with a name only. Date (YYYY-MM-DD) or date-time the link stops working; must be in the future. Leave out for no expiry."),
  },
  handler: async ({ slug, level, tab, name, expires_at }, ctx) => {
    const origin = linkOrigin(ctx.origin);
    const checklist = await loadChecklist(slug);
    const tabs = resolveTabs(checklist, tab);
    const common = { checklist: checklist.clientName, slug: checklist.slug, opens: tabs.tabLabel ?? "the start page", host: new URL(origin).host };

    if (level === "view") {
      if (name || expires_at) throw new ChecklistToolError("A view link cannot have a name or an expiry. Leave name and expires_at out.");
      const result = await (await viewLinks()).enableViewLink(checklist.id);
      if (!result.ok || !result.token) throw new ChecklistToolError("Could not turn on the view link. Please try again.");
      return {
        ...common,
        level: "view",
        url: viewUrl(origin, result.token, tabs.viewSlug),
        ...(tabs.notes.length ? { notes: tabs.notes } : {}),
        note: "Read-only. Copy it into your own email; nothing is sent from here. Turn it off or give it a new address with change_checklist_link.",
      };
    }

    if (!name) {
      if (expires_at) throw new ChecklistToolError("The original shared edit link has no expiry. Give a name to make a named edit link that can expire.");
      return {
        ...common,
        level: "edit",
        kind: "original shared link",
        url: editUrl(origin, checklist.editorToken, tabs.editSlug),
        note:
          "Anyone with this address can change the checklist. In the edit history their changes show as 'Original shared link'. " +
          "To record changes under one person's name instead, call again with name. Nothing is sent from here.",
      };
    }

    const link = await createEditLink({
      checklistId: checklist.id,
      name,
      createdByLabel: ctx.actor.label,
      expiresAt: parseExpiry(expires_at),
    });
    return {
      ...common,
      level: "edit",
      kind: "named edit link",
      name: link.name,
      linkId: link.id,
      url: editUrl(origin, link.token, tabs.editSlug),
      expiresAt: link.expiresAt,
      note: `Their changes show in the edit history as "${link.name}". Copy it into your own email; nothing is sent from here.`,
    };
  },
});

export const listChecklistLinksTool = defineTool({
  name: "list_checklist_links",
  description:
    "Show the client links a checklist has: whether the view link is on, the original shared edit link, and every named edit link with its status, who made it and when it was last opened. " +
    "The addresses are secret and give access, so only use this when the user asks who has access or needs a link again; they are not shown to read-only logins.",
  // Tagged "write" on purpose: it shows secret link addresses, so a read-only login must not be offered it (the website refuses them too).
  access: "write",
  input: { slug: slugField },
  handler: async ({ slug }, ctx) => {
    const origin = linkOrigin(ctx.origin);
    const checklist = await loadChecklist(slug);
    const named = await listEditLinks(checklist.id);
    return {
      checklist: checklist.clientName,
      slug: checklist.slug,
      host: new URL(origin).host,
      viewLink: checklist.viewToken
        ? { on: true, url: viewUrl(origin, checklist.viewToken, "welcome") }
        : { on: false },
      originalEditLink: {
        url: editUrl(origin, checklist.editorToken, "welcome"),
        note: "Changes show in the edit history as 'Original shared link'. To replace it, use Regenerate original editor link in the website's checklist menu.",
      },
      namedEditLinks: named.map((l) => ({
        id: l.id,
        name: l.name,
        status: linkStatus(l),
        url: l.revokedAt ? null : editUrl(origin, l.token, "welcome"),
        createdBy: l.createdByLabel,
        createdAt: l.createdAt,
        firstOpenedAt: l.firstOpenedAt,
        lastUsedAt: l.lastUsedAt,
        expiresAt: l.expiresAt,
      })),
    };
  },
});

export const changeChecklistLinkTool = defineTool({
  name: "change_checklist_link",
  description:
    "Turn a checklist link off, or give it a new address. Either way the old address stops working at once for everyone who has it, so a new address has to be sent again. " +
    "link 'view' = the read-only view link. Otherwise link is the id of a named edit link from list_checklist_links. " +
    "The original shared edit link cannot be turned off or changed here (use Regenerate original editor link in the website's checklist menu). A turned-off named edit link keeps its place in the edit history." +
    EXPLICIT,
  access: "write",
  input: {
    slug: slugField,
    link: z.string().describe("'view' for the view link, or the id of a named edit link from list_checklist_links"),
    action: z.enum(["turn_off", "new_address"]).describe("turn_off = stops working; new_address = same link, new secret address (returned)"),
  },
  handler: async ({ slug, link, action }, ctx) => {
    const checklist = await loadChecklist(slug);
    const common = { checklist: checklist.clientName, slug: checklist.slug };

    if (link === "view") {
      if (action === "turn_off") {
        await (await viewLinks()).disableViewLink(checklist.id);
        return { ...common, link: "view", status: "turned off", note: "The old view address no longer works. Create a new one any time with create_checklist_link." };
      }
      if (!checklist.viewToken) throw new ChecklistToolError("The view link is off, so there is no address to replace. Use create_checklist_link to make one.");
      const result = await (await viewLinks()).regenerateViewLink(checklist.id);
      if (!result.ok || !result.token) throw new ChecklistToolError("Could not give the view link a new address. Please try again.");
      return {
        ...common,
        link: "view",
        status: "new address",
        url: viewUrl(linkOrigin(ctx.origin), result.token, "welcome"),
        note: "The old view address no longer works. Send the new one.",
      };
    }

    try {
      if (action === "turn_off") {
        const row = await revokeEditLink(checklist.id, link);
        return { ...common, link: row.id, name: row.name, status: "turned off", note: "That address no longer works. The edit history keeps the name." };
      }
      const row = await regenerateEditLink(checklist.id, link);
      return {
        ...common,
        link: row.id,
        name: row.name,
        status: "new address",
        url: editUrl(linkOrigin(ctx.origin), row.token, "welcome"),
        note: "The old address no longer works. Send the new one.",
      };
    } catch (err) {
      // A bad id comes back as "Link not found"; say what to do about it.
      if (err instanceof EditLinkError && err.status === 404) {
        throw new ChecklistToolError(`No named edit link with the id "${link}" on this checklist. Use list_checklist_links to see the ids, or 'view' for the view link.`);
      }
      throw err;
    }
  },
});

export const checklistShareTools = [createChecklistLinkTool, listChecklistLinksTool, changeChecklistLinkTool];
