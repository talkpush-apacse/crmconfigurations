/**
 * Shared pieces for the Project Tracker tools: turning names Claude says ("UAT sign-off", "Maria")
 * into ids, shaping item output, and the input fields several tools share.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, notFound, TrackerError } from "@/lib/tracker/errors";
import { JIRA_EXAMPLE_URL, jiraUrlsOf } from "@/lib/tracker/jira";
import type { updateItem } from "@/lib/tracker/item-service";
import { matchByName, type MatchResult } from "@/lib/tracker/match";
import { getProjectDetail } from "@/lib/tracker/project-service";

export function pick<T>(m: MatchResult<T>, what: string, query: string, describe: (item: T) => string): T {
  if (m.kind === "one") return m.value;
  if (m.kind === "none") throw new TrackerError(`No ${what} matches "${query}".`, 404);
  throw new TrackerError(
    `More than one ${what} matches "${query}": ${m.candidates.slice(0, 8).map(describe).join("; ")}. Use the id or a more specific name.`,
    400
  );
}

// ---------------------------------------------------------------------------
// name resolution (so Claude can say "UAT sign-off" instead of an id)
// ---------------------------------------------------------------------------

export async function resolveAccountId(ref: string): Promise<string> {
  const accounts = await prisma.trackerAccount.findMany({ where: { archived: false }, select: { id: true, name: true } });
  const byId = accounts.find((a) => a.id === ref);
  if (byId) return byId.id;
  return pick(matchByName(accounts, ref, (a) => a.name), "account", ref, (a) => `${a.name} (${a.id})`).id;
}

export async function resolveProjectId(args: { project_id?: string; project?: string; account?: string }): Promise<string> {
  if (args.project_id) {
    const found = await prisma.trackerProject.findUnique({ where: { id: args.project_id }, select: { id: true } });
    if (!found) throw notFound("Project");
    return found.id;
  }
  if (!args.project) throw badRequest("Give a project_id, or a project title.");
  const all = await prisma.trackerProject.findMany({
    where: { archived: false },
    select: { id: true, title: true, account: { select: { name: true } } },
  });
  const pool = args.account ? all.filter((p) => p.account.name.toLowerCase().includes(args.account!.trim().toLowerCase())) : all;
  return pick(matchByName(pool, args.project, (p) => p.title), "project", args.project, (p) => `${p.title} for ${p.account.name} (${p.id})`).id;
}

export async function loadContext(projectId: string) {
  const detail = await getProjectDetail(projectId);
  return { projectId, accountId: detail.project.accountId, phases: detail.phases, people: detail.people, items: detail.items };
}
export type ProjectContext = Awaited<ReturnType<typeof loadContext>>;

export function resolveItem(ctx: ProjectContext, args: { item_id?: string; item?: string }) {
  if (args.item_id) {
    const found = ctx.items.find((i) => i.id === args.item_id);
    if (!found) throw notFound("Item");
    return found;
  }
  if (!args.item) throw badRequest("Give an item_id, or an item title together with the project.");
  return pick(matchByName(ctx.items, args.item, (i) => i.title), "item", args.item, (i) => `${i.title} (${i.id})`);
}

export function resolvePersonId(ctx: ProjectContext, name: string | null | undefined): string | null | undefined {
  if (name === undefined) return undefined;
  if (name === null || name.trim() === "" || name.trim().toLowerCase() === "none") return null;
  const byId = ctx.people.find((p) => p.id === name);
  if (byId) return byId.id;
  return pick(matchByName(ctx.people, name, (p) => p.name), "person", name, (p) => `${p.name} (${p.side}, ${p.id})`).id;
}

export function resolvePhaseId(ctx: ProjectContext, name: string | null | undefined): string | null | undefined {
  if (name === undefined) return undefined;
  if (name === null || name.trim() === "" || name.trim().toLowerCase() === "none") return null;
  const byId = ctx.phases.find((p) => p.id === name);
  if (byId) return byId.id;
  return pick(matchByName(ctx.phases, name, (p) => p.name), "phase", name, (p) => p.name).id;
}

export function resolveItemIds(ctx: ProjectContext, refs: string[], extraTitles: { id: string; title: string }[] = []): string[] {
  const pool = [...ctx.items.map((i) => ({ id: i.id, title: i.title })), ...extraTitles];
  return refs.map((ref) => {
    const byId = pool.find((i) => i.id === ref);
    if (byId) return byId.id;
    return pick(matchByName(pool, ref, (i) => i.title), "item", ref, (i) => `${i.title} (${i.id})`).id;
  });
}

type ItemOut = Awaited<ReturnType<typeof updateItem>>;
export function itemOut(i: ItemOut) {
  return {
    id: i.id,
    title: i.title,
    status: i.status,
    owner: i.ownerName,
    ownerSide: i.ownerSide,
    phase: i.phaseName,
    dueDate: i.dueDate,
    isMilestone: i.isMilestone,
    visibility: i.visibility,
    blockerReason: i.blockerReason,
    waitingOn: i.waitingOn,
    blockedByItemIds: i.blockedByItemIds,
    jiraLinks: jiraUrlsOf(i.links),
  };
}

// ---------------------------------------------------------------------------
// shared input fragments
// ---------------------------------------------------------------------------

export const projectRef = {
  project_id: z.string().optional().describe("Project id from list_tracker_projects"),
  project: z.string().optional().describe("Project title, instead of project_id (exact or unique partial match)"),
  account: z.string().optional().describe("Account name, only to tell apart two projects with the same title"),
};
export const itemRef = {
  item_id: z.string().optional().describe("Item id (from list_open_items or get_project_summary)"),
  item: z.string().optional().describe("Item title instead of item_id (exact or unique partial match; also needs the project)"),
};
export const date = z.string().nullable().optional().describe("Calendar date as YYYY-MM-DD. null clears it.");

export const JIRA_LINKS_NOTE = `Jira ticket addresses on talkpush.atlassian.net, for example ${JIRA_EXAMPLE_URL}. Other sites are refused. Staff only: clients never see them.`;

export const VISIBILITY_NOTE =
  "Items are visible to the client by default. Use visibility 'internal' for anything the client should not see.";
