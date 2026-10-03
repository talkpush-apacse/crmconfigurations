/** Project Tracker tools that only read. */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { listAccounts, listPeople } from "@/lib/tracker/directory-service";
import { getProjectDetail, getProjectSnapshot, listPortfolio } from "@/lib/tracker/project-service";
import { ITEM_STATUSES, OPEN_ITEM_STATUSES, PROJECT_STATUSES } from "@/lib/tracker/constants";
import { overdueDays } from "@/lib/tracker/dates";
import { itemOut, projectRef, resolveAccountId, resolveProjectId } from "./helpers";

export const listTrackerProjects = defineTool({
  name: "list_tracker_projects",
  description: "List implementation projects with health, progress and target date. Use this first to find project ids.",
  access: "read",
  input: {
    account: z.string().optional().describe("Only projects whose account name contains this text"),
    status: z.enum(PROJECT_STATUSES).optional(),
    include_archived: z.boolean().optional(),
  },
  handler: async ({ account, status, include_archived }) => {
    const rows = await listPortfolio({ includeArchived: include_archived });
    return rows
      .filter((p) => !account || p.accountName.toLowerCase().includes(account.trim().toLowerCase()))
      .filter((p) => !status || p.status === status)
      .map((p) => ({
        id: p.id,
        title: p.title,
        account: p.accountName,
        status: p.status,
        health: p.summary.health.level,
        healthReasons: p.summary.health.reasons,
        percentDone: p.summary.percentDone,
        open: p.summary.open,
        overdue: p.summary.overdue,
        blocked: p.summary.blocked,
        targetDate: p.targetDate,
        daysToTarget: p.summary.daysToTarget,
      }));
  },
});

export const getProjectSummary = defineTool({
  name: "get_project_summary",
  description:
    "Answer 'where are we now and what is still open' for one project: headline, health and reasons, progress, what needs attention (overdue, blocked, waiting on client, due soon), open items by owner side, phases, success metrics and recent activity.",
  access: "read",
  input: { ...projectRef },
  handler: async (args) => getProjectSnapshot(await resolveProjectId(args)),
});

export const listOpenItems = defineTool({
  name: "list_open_items",
  description: "List items in a project. Defaults to open items (not done or dropped). Filter by owner name, status, or overdue.",
  access: "read",
  input: {
    ...projectRef,
    owner: z.string().optional().describe("Owner name contains this text"),
    status: z.enum(ITEM_STATUSES).optional(),
    overdue_only: z.boolean().optional(),
    include_closed: z.boolean().optional().describe("Also include done and dropped items"),
  },
  handler: async ({ owner, status, overdue_only, include_closed, ...ref }) => {
    const projectId = await resolveProjectId(ref);
    const detail = await getProjectDetail(projectId);
    return detail.items
      .filter((i) => (include_closed ? true : (OPEN_ITEM_STATUSES as readonly string[]).includes(i.status)))
      .filter((i) => !status || i.status === status)
      .filter((i) => !owner || (i.ownerName ?? "").toLowerCase().includes(owner.trim().toLowerCase()))
      .filter((i) => !overdue_only || overdueDays(i.dueDate, detail.today) > 0)
      .map(itemOut);
  },
});

export const listAccountsTool = defineTool({
  name: "list_accounts",
  description: "List client accounts (companies).",
  access: "read",
  input: {},
  handler: async () =>
    (await listAccounts()).map((a) => ({ id: a.id, name: a.name, projects: a.projectCount, contacts: a.peopleCount })),
});

export const listPeopleTool = defineTool({
  name: "list_people",
  description: "List Talkpush staff plus, optionally, one account's client contacts and vendors. Use this to find owner names.",
  access: "read",
  input: { account: z.string().optional().describe("Account name or id; omit for Talkpush staff only") },
  handler: async ({ account }) => {
    const accountId = account ? await resolveAccountId(account) : null;
    return (await listPeople({ accountId })).map((p) => ({
      id: p.id,
      name: p.name,
      side: p.side,
      account: p.accountName,
      title: p.title,
    }));
  },
});

export const trackerReadTools = [listTrackerProjects, getProjectSummary, listOpenItems, listAccountsTool, listPeopleTool];
