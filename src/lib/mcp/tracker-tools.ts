/**
 * Project Tracker MCP tools.
 *
 * Every tool calls the same service layer as the website (src/lib/tracker), so
 * the rules (blocker reasons, dependency loops, validation, activity log) are
 * identical whichever way a change is made. Writes are logged as "Claude (MCP)".
 * There is deliberately NO hard-delete tool: archive_item hides an item and the
 * activity history keeps it.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/tracker/actor";
import { createAccount, createPerson, listAccounts, listPeople } from "@/lib/tracker/directory-service";
import { badRequest, notFound, TrackerError } from "@/lib/tracker/errors";
import { addRemark, createItem, updateItem } from "@/lib/tracker/item-service";
import { matchByName, type MatchResult } from "@/lib/tracker/match";
import { createMetric, listMetrics, recordReading } from "@/lib/tracker/metric-service";
import {
  createProject,
  getProjectDetail,
  getProjectSnapshot,
  listPortfolio,
  updatePhase,
  updateProject,
} from "@/lib/tracker/project-service";
import {
  HEALTH_LEVELS,
  ITEM_STATUSES,
  ITEM_TYPES,
  ITEM_VISIBILITIES,
  OPEN_ITEM_STATUSES,
  PERSON_SIDES,
  PRIORITIES,
  PROJECT_STATUSES,
  REMARK_VISIBILITIES,
} from "@/lib/tracker/constants";
import { overdueDays } from "@/lib/tracker/dates";

const ACTOR: Actor = { label: "Claude (MCP)", via: "mcp" };

// ---------------------------------------------------------------------------
// result helpers
// ---------------------------------------------------------------------------

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof ZodError) {
      return fail(`Some fields need attention: ${err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);
    }
    if (err instanceof TrackerError) return fail(err.message);
    console.error("[tracker-mcp] tool error:", err instanceof Error ? err.message : err);
    return fail("Something went wrong. Please try again.");
  }
}

function pick<T>(m: MatchResult<T>, what: string, query: string, describe: (item: T) => string): T {
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

async function resolveAccountId(ref: string): Promise<string> {
  const accounts = await prisma.trackerAccount.findMany({ where: { archived: false }, select: { id: true, name: true } });
  const byId = accounts.find((a) => a.id === ref);
  if (byId) return byId.id;
  return pick(matchByName(accounts, ref, (a) => a.name), "account", ref, (a) => `${a.name} (${a.id})`).id;
}

async function resolveProjectId(args: { project_id?: string; project?: string; account?: string }): Promise<string> {
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

async function loadContext(projectId: string) {
  const detail = await getProjectDetail(projectId);
  return { projectId, accountId: detail.project.accountId, phases: detail.phases, people: detail.people, items: detail.items };
}
type Ctx = Awaited<ReturnType<typeof loadContext>>;

function resolveItem(ctx: Ctx, args: { item_id?: string; item?: string }) {
  if (args.item_id) {
    const found = ctx.items.find((i) => i.id === args.item_id);
    if (!found) throw notFound("Item");
    return found;
  }
  if (!args.item) throw badRequest("Give an item_id, or an item title together with the project.");
  return pick(matchByName(ctx.items, args.item, (i) => i.title), "item", args.item, (i) => `${i.title} (${i.id})`);
}

function resolvePersonId(ctx: Ctx, name: string | null | undefined): string | null | undefined {
  if (name === undefined) return undefined;
  if (name === null || name.trim() === "" || name.trim().toLowerCase() === "none") return null;
  const byId = ctx.people.find((p) => p.id === name);
  if (byId) return byId.id;
  return pick(matchByName(ctx.people, name, (p) => p.name), "person", name, (p) => `${p.name} (${p.side}, ${p.id})`).id;
}

function resolvePhaseId(ctx: Ctx, name: string | null | undefined): string | null | undefined {
  if (name === undefined) return undefined;
  if (name === null || name.trim() === "" || name.trim().toLowerCase() === "none") return null;
  const byId = ctx.phases.find((p) => p.id === name);
  if (byId) return byId.id;
  return pick(matchByName(ctx.phases, name, (p) => p.name), "phase", name, (p) => p.name).id;
}

function resolveItemIds(ctx: Ctx, refs: string[], extraTitles: { id: string; title: string }[] = []): string[] {
  const pool = [...ctx.items.map((i) => ({ id: i.id, title: i.title })), ...extraTitles];
  return refs.map((ref) => {
    const byId = pool.find((i) => i.id === ref);
    if (byId) return byId.id;
    return pick(matchByName(pool, ref, (i) => i.title), "item", ref, (i) => `${i.title} (${i.id})`).id;
  });
}

type ItemOut = Awaited<ReturnType<typeof updateItem>>;
function itemOut(i: ItemOut) {
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
  };
}

// ---------------------------------------------------------------------------
// shared input fragments
// ---------------------------------------------------------------------------

const projectRef = {
  project_id: z.string().optional().describe("Project id from list_tracker_projects"),
  project: z.string().optional().describe("Project title, instead of project_id (exact or unique partial match)"),
  account: z.string().optional().describe("Account name, only to tell apart two projects with the same title"),
};
const itemRef = {
  item_id: z.string().optional().describe("Item id (from list_open_items or get_project_summary)"),
  item: z.string().optional().describe("Item title instead of item_id (exact or unique partial match; also needs the project)"),
};
const date = z.string().nullable().optional().describe("Calendar date as YYYY-MM-DD. null clears it.");

const VISIBILITY_NOTE =
  "Items are visible to the client by default. Use visibility 'internal' for anything the client should not see.";

// ---------------------------------------------------------------------------

export function createTrackerMcpServer(): McpServer {
  const server = new McpServer(
    { name: "Project Tracker", version: "1.0.0" },
    {
      instructions:
        "Talkpush implementation Project Tracker. Start with list_tracker_projects, then get_project_summary for 'where are we now'. " +
        "Refer to items and people by name; if a name is ambiguous the tool lists the candidates. Moving an item to blocked needs a blocker_reason. " +
        "There is no delete: use archive_item. Items and remarks you add are visible to the client unless you mark them internal.",
    }
  );

  // ----- reads -------------------------------------------------------------

  server.tool(
    "list_tracker_projects",
    "List implementation projects with health, progress and target date. Use this first to find project ids.",
    {
      account: z.string().optional().describe("Only projects whose account name contains this text"),
      status: z.enum(PROJECT_STATUSES).optional(),
      include_archived: z.boolean().optional(),
    },
    async ({ account, status, include_archived }) =>
      run(async () => {
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
      })
  );

  server.tool(
    "get_project_summary",
    "Answer 'where are we now and what is still open' for one project: headline, health and reasons, progress, what needs attention (overdue, blocked, waiting on client, due soon), open items by owner side, phases, success metrics and recent activity.",
    { ...projectRef },
    async (args) => run(async () => getProjectSnapshot(await resolveProjectId(args)))
  );

  server.tool(
    "list_open_items",
    "List items in a project. Defaults to open items (not done or dropped). Filter by owner name, status, or overdue.",
    {
      ...projectRef,
      owner: z.string().optional().describe("Owner name contains this text"),
      status: z.enum(ITEM_STATUSES).optional(),
      overdue_only: z.boolean().optional(),
      include_closed: z.boolean().optional().describe("Also include done and dropped items"),
    },
    async ({ owner, status, overdue_only, include_closed, ...ref }) =>
      run(async () => {
        const projectId = await resolveProjectId(ref);
        const detail = await getProjectDetail(projectId);
        return detail.items
          .filter((i) => (include_closed ? true : (OPEN_ITEM_STATUSES as readonly string[]).includes(i.status)))
          .filter((i) => !status || i.status === status)
          .filter((i) => !owner || (i.ownerName ?? "").toLowerCase().includes(owner.trim().toLowerCase()))
          .filter((i) => !overdue_only || overdueDays(i.dueDate, detail.today) > 0)
          .map(itemOut);
      })
  );

  server.tool(
    "list_accounts",
    "List client accounts (companies).",
    {},
    async () => run(async () => (await listAccounts()).map((a) => ({ id: a.id, name: a.name, projects: a.projectCount, contacts: a.peopleCount })))
  );

  server.tool(
    "list_people",
    "List Talkpush staff plus, optionally, one account's client contacts and vendors. Use this to find owner names.",
    { account: z.string().optional().describe("Account name or id; omit for Talkpush staff only") },
    async ({ account }) =>
      run(async () => {
        const accountId = account ? await resolveAccountId(account) : null;
        return (await listPeople({ accountId })).map((p) => ({ id: p.id, name: p.name, side: p.side, account: p.accountName, title: p.title }));
      })
  );

  // ----- accounts, people, projects ---------------------------------------

  server.tool(
    "create_account",
    "Create a client account (company).",
    { name: z.string(), notes: z.string().optional().describe("Internal notes. Never shown to clients.") },
    async (args) => run(async () => createAccount(args))
  );

  server.tool(
    "create_person",
    "Add a person who can own items: Talkpush staff (omit account), or a client contact or vendor (give account).",
    {
      name: z.string(),
      side: z.enum(PERSON_SIDES),
      account: z.string().optional().describe("Account name or id. Required for client and vendor."),
      email: z.string().optional(),
      title: z.string().optional(),
      organisation: z.string().optional().describe("For vendors: their company"),
    },
    async ({ account, ...rest }) =>
      run(async () => createPerson({ ...rest, accountId: account ? await resolveAccountId(account) : null }))
  );

  server.tool(
    "create_project",
    "Create a project for an account. It starts with the standard phases (Scoping, Configuration, Integration, UAT, Training, Go-live, Hypercare).",
    {
      account: z.string().describe("Account name or id"),
      title: z.string(),
      objective: z.string().optional(),
      start_date: date,
      target_date: date,
      go_live_date: date,
      owner: z.string().optional().describe("Project owner's name"),
      sponsor: z.string().optional().describe("Sponsor's name"),
    },
    async (args) =>
      run(async () => {
        const accountId = await resolveAccountId(args.account);
        const people = await listPeople({ accountId });
        const personId = (name?: string) => (name ? pick(matchByName(people, name, (p) => p.name), "person", name, (p) => `${p.name} (${p.side})`).id : null);
        return createProject(
          {
            accountId,
            title: args.title,
            objective: args.objective,
            startDate: args.start_date,
            targetDate: args.target_date,
            goLiveDate: args.go_live_date,
            ownerPersonId: personId(args.owner),
            sponsorPersonId: personId(args.sponsor),
          },
          ACTOR
        );
      })
  );

  server.tool(
    "update_project",
    "Change project details. Moving the target date counts as a reschedule and is shown on the project. Setting health_override needs health_override_note; use 'calculated' to clear it.",
    {
      ...projectRef,
      title: z.string().optional(),
      objective: z.string().nullable().optional(),
      status: z.enum(PROJECT_STATUSES).optional(),
      start_date: date,
      target_date: date,
      go_live_date: date,
      owner: z.string().nullable().optional().describe("Owner name; null clears"),
      sponsor: z.string().nullable().optional().describe("Sponsor name; null clears"),
      health_override: z.enum([...HEALTH_LEVELS, "calculated"]).optional(),
      health_override_note: z.string().optional(),
    },
    async (args) =>
      run(async () => {
        const projectId = await resolveProjectId(args);
        const ctx = await loadContext(projectId);
        return updateProject(
          projectId,
          {
            title: args.title,
            objective: args.objective,
            status: args.status,
            startDate: args.start_date,
            targetDate: args.target_date,
            goLiveDate: args.go_live_date,
            ownerPersonId: resolvePersonId(ctx, args.owner),
            sponsorPersonId: resolvePersonId(ctx, args.sponsor),
            healthOverride: args.health_override === undefined ? undefined : args.health_override === "calculated" ? null : args.health_override,
            healthOverrideNote: args.health_override_note,
          },
          ACTOR
        );
      })
  );

  server.tool(
    "update_phase",
    "Set a phase's start date, end date or exit criteria.",
    {
      ...projectRef,
      phase: z.string().describe("Phase name, for example UAT"),
      start_date: date,
      end_date: date,
      exit_criteria: z.string().nullable().optional(),
    },
    async ({ phase, start_date, end_date, exit_criteria, ...ref }) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(ref));
        const phaseId = resolvePhaseId(ctx, phase);
        if (!phaseId) throw badRequest("Give the phase name.");
        return updatePhase(phaseId, { startDate: start_date, endDate: end_date, exitCriteria: exit_criteria }, ACTOR);
      })
  );

  // ----- items -------------------------------------------------------------

  const newItem = z.object({
    title: z.string(),
    description: z.string().optional(),
    type: z.enum(ITEM_TYPES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(ITEM_STATUSES).optional(),
    visibility: z.enum(ITEM_VISIBILITIES).optional().describe(VISIBILITY_NOTE),
    is_milestone: z.boolean().optional(),
    phase: z.string().optional().describe("Phase name"),
    owner: z.string().optional().describe("Owner's name (see list_people)"),
    start_date: date,
    due_date: date,
    blocker_reason: z.string().optional().describe("Required when status is blocked"),
    waiting_on: z.string().optional(),
    external_dependency: z.string().optional(),
    blocked_by: z.array(z.string()).optional().describe("Titles or ids of items this one waits for. May name items created earlier in the same call."),
  });

  server.tool(
    "add_open_items",
    `Add one or more items to a project. All names are checked before anything is created, so a typo creates nothing. ${VISIBILITY_NOTE}`,
    { ...projectRef, items: z.array(newItem).min(1).max(50) },
    async ({ items, ...ref }) =>
      run(async () => {
        const projectId = await resolveProjectId(ref);
        const ctx = await loadContext(projectId);
        const batchTitles = items.map((i) => ({ id: `batch:${i.title}`, title: i.title }));

        // Resolve everything first, so a bad name stops the whole call before any write.
        const prepared = items.map((it, index) => {
          const ownerPersonId = resolvePersonId(ctx, it.owner);
          const phaseId = resolvePhaseId(ctx, it.phase);
          const earlier = batchTitles.slice(0, index);
          const refs = (it.blocked_by ?? []).map((b) => {
            const inBatch = matchByName(earlier, b, (e) => e.title);
            if (inBatch.kind === "one") return inBatch.value.id;
            return resolveItemIds(ctx, [b])[0];
          });
          return { it, ownerPersonId: ownerPersonId ?? null, phaseId: phaseId ?? null, refs };
        });

        const createdIds = new Map<string, string>();
        const created = [];
        for (const { it, ownerPersonId, phaseId, refs } of prepared) {
          const blockedByItemIds = refs.map((r) => (r.startsWith("batch:") ? (createdIds.get(r) as string) : r));
          const item = await createItem(
            projectId,
            {
              title: it.title,
              description: it.description,
              type: it.type,
              priority: it.priority,
              status: it.status,
              visibility: it.visibility,
              isMilestone: it.is_milestone,
              phaseId,
              ownerPersonId,
              startDate: it.start_date,
              dueDate: it.due_date,
              blockerReason: it.blocker_reason,
              waitingOn: it.waiting_on,
              externalDependency: it.external_dependency,
              blockedByItemIds,
            },
            ACTOR
          );
          createdIds.set(`batch:${it.title}`, item.id);
          created.push(itemOut(item));
        }
        return { created };
      })
  );

  server.tool(
    "update_item_status",
    "Change an item's status. Moving to blocked needs blocker_reason. Optionally leave a remark in the same call.",
    {
      ...projectRef,
      ...itemRef,
      status: z.enum(ITEM_STATUSES),
      blocker_reason: z.string().optional(),
      remark: z.string().optional().describe("Optional note to record with the change"),
      remark_visibility: z.enum(REMARK_VISIBILITIES).optional().describe("Defaults to internal"),
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(args));
        const target = resolveItem(ctx, args);
        const updated = await updateItem(target.id, { status: args.status, blockerReason: args.blocker_reason }, ACTOR);
        if (args.remark) await addRemark(target.id, { body: args.remark, visibility: args.remark_visibility ?? "internal" }, ACTOR);
        return itemOut(updated);
      })
  );

  server.tool(
    "update_item",
    "Change an item's details (not its status; use update_item_status for that). Pass null to clear owner, phase or dates.",
    {
      ...projectRef,
      ...itemRef,
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      type: z.enum(ITEM_TYPES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      visibility: z.enum(ITEM_VISIBILITIES).optional(),
      is_milestone: z.boolean().optional(),
      phase: z.string().nullable().optional(),
      owner: z.string().nullable().optional(),
      start_date: date,
      due_date: date,
      waiting_on: z.string().nullable().optional(),
      external_dependency: z.string().nullable().optional(),
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(args));
        const target = resolveItem(ctx, args);
        return itemOut(
          await updateItem(
            target.id,
            {
              title: args.title,
              description: args.description,
              type: args.type,
              priority: args.priority,
              visibility: args.visibility,
              isMilestone: args.is_milestone,
              phaseId: resolvePhaseId(ctx, args.phase),
              ownerPersonId: resolvePersonId(ctx, args.owner),
              startDate: args.start_date,
              dueDate: args.due_date,
              waitingOn: args.waiting_on,
              externalDependency: args.external_dependency,
            },
            ACTOR
          )
        );
      })
  );

  server.tool(
    "add_item_remark",
    "Add a remark to an item. Internal by default; set visibility 'shared' only for text the client may read.",
    { ...projectRef, ...itemRef, body: z.string(), visibility: z.enum(REMARK_VISIBILITIES).optional() },
    async (args) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(args));
        const target = resolveItem(ctx, args);
        return addRemark(target.id, { body: args.body, visibility: args.visibility ?? "internal" }, ACTOR);
      })
  );

  server.tool(
    "set_item_dependency",
    "Say which items an item is waiting for. mode 'add' (default) adds to the list, 'remove' removes, 'replace' sets the exact list. Loops are rejected.",
    {
      ...projectRef,
      ...itemRef,
      blocked_by: z.array(z.string()).describe("Titles or ids of the items it waits for"),
      mode: z.enum(["add", "remove", "replace"]).optional(),
    },
    async (args) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(args));
        const target = resolveItem(ctx, args);
        const wanted = resolveItemIds(ctx, args.blocked_by);
        const current = target.blockedByItemIds;
        const mode = args.mode ?? "add";
        const next =
          mode === "replace" ? wanted : mode === "remove" ? current.filter((id) => !wanted.includes(id)) : Array.from(new Set([...current, ...wanted]));
        return itemOut(await updateItem(target.id, { blockedByItemIds: next }, ACTOR));
      })
  );

  server.tool(
    "archive_item",
    "Hide an item from the project. Nothing is deleted: the activity history keeps it.",
    { ...projectRef, ...itemRef },
    async (args) =>
      run(async () => {
        const ctx = await loadContext(await resolveProjectId(args));
        const target = resolveItem(ctx, args);
        return itemOut(await updateItem(target.id, { archived: true }, ACTOR));
      })
  );

  // ----- success metrics ---------------------------------------------------

  server.tool(
    "add_success_metric",
    "Add a success metric with its baseline and target, for example 'Time to hire', 'days', lower_is_better, baseline 21, target 14.",
    {
      ...projectRef,
      name: z.string(),
      unit: z.string().describe("For example days, %, candidates per week"),
      direction: z.enum(["higher_is_better", "lower_is_better"]).optional(),
      baseline_value: z.number().optional(),
      baseline_date: date,
      target_value: z.number().optional(),
      current_value: z.number().optional(),
      current_as_of: date,
      source: z.string().optional().describe("Where the number comes from"),
      visibility: z.enum(ITEM_VISIBILITIES).optional().describe("Defaults to client_visible"),
    },
    async ({ name, unit, direction, baseline_value, baseline_date, target_value, current_value, current_as_of, source, visibility, ...ref }) =>
      run(async () =>
        createMetric(
          await resolveProjectId(ref),
          { name, unit, direction, baselineValue: baseline_value, baselineDate: baseline_date, targetValue: target_value, currentValue: current_value, currentAsOf: current_as_of, source, visibility },
          ACTOR
        )
      )
  );

  server.tool(
    "record_metric_reading",
    "Record a new measurement for a success metric. The metric's current value follows the newest reading.",
    {
      ...projectRef,
      metric_id: z.string().optional(),
      metric: z.string().optional().describe("Metric name instead of metric_id (needs the project)"),
      value: z.number(),
      as_of: date.describe("Date of the measurement, YYYY-MM-DD. Defaults to today."),
      note: z.string().optional(),
    },
    async ({ metric_id, metric, value, as_of, note, ...ref }) =>
      run(async () => {
        let id = metric_id;
        if (!id) {
          if (!metric) throw badRequest("Give a metric_id, or a metric name with the project.");
          const metrics = await listMetrics(await resolveProjectId(ref));
          id = pick(matchByName(metrics, metric, (m) => m.name), "metric", metric, (m) => `${m.name} (${m.id})`).id;
        }
        return recordReading(id, { value, asOf: as_of, note }, ACTOR);
      })
  );

  return server;
}
