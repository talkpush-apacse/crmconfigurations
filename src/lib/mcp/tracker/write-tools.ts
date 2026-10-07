/**
 * Project Tracker tools that change data. Every one calls the same service layer as the website, so
 * the rules (blocker reasons, dependency loops, validation, activity log) are identical either way.
 * There is deliberately NO hard-delete tool: archive_item hides an item and the activity history keeps it.
 */

import { z } from "zod";
import { defineTool } from "@/lib/mcp/toolkit";
import { createAccount, createPerson, listPeople } from "@/lib/tracker/directory-service";
import { badRequest } from "@/lib/tracker/errors";
import { addRemark, createItem, updateItem } from "@/lib/tracker/item-service";
import { MAX_JIRA_LINKS } from "@/lib/tracker/jira";
import { matchByName } from "@/lib/tracker/match";
import { createMetric, listMetrics, recordReading } from "@/lib/tracker/metric-service";
import { createPhases, createProject, updatePhase, updateProject } from "@/lib/tracker/project-service";
import {
  HEALTH_LEVELS,
  ITEM_STATUSES,
  ITEM_TYPES,
  ITEM_VISIBILITIES,
  PERSON_SIDES,
  PRIORITIES,
  PROJECT_STATUSES,
  REMARK_VISIBILITIES,
} from "@/lib/tracker/constants";
import {
  date,
  itemOut,
  itemRef,
  JIRA_LINKS_NOTE,
  loadContext,
  pick,
  projectRef,
  resolveAccountId,
  resolveItem,
  resolveItemIds,
  resolvePersonId,
  resolvePhaseId,
  resolveProjectId,
  VISIBILITY_NOTE,
} from "./helpers";

// ----- accounts, people, projects -------------------------------------------

export const createAccountTool = defineTool({
  name: "create_account",
  description:
    "Create a client account: a company in one geo, for example Concentrix in the Philippines is the account \"Concentrix PH\". Give company and geo and the account name is built for you (company + the geo's short code: PH, US, UK, SG, APAC...). There is only ever one of each company: a company name that already exists (ignoring capitals, punctuation and endings like Inc) is reused, so do not create a second Concentrix. A company has at most one account per geo. Checklists, workflows and trackers link to the account. Geo is a country (\"Philippines\" or \"PH\") or a region (Global, APAC, EMEA, LATAM, North America); any other geo also needs geo_code. Use name alone only for an account with no company. The account name is what clients see on their tracker link.",
  access: "write",
  input: {
    company: z.string().optional().describe("The company, for example \"Concentrix\". Use list_accounts to see the companies that exist."),
    geo: z.string().optional().describe("The geo: a country name or code, or Global, APAC, EMEA, LATAM, North America."),
    geo_code: z.string().optional().describe("The short code for a geo that is not a country or region in the list, for example GBA."),
    name: z.string().optional().describe("Only to override the generated name (\"Concentrix PH\"), or for an account with no company."),
    notes: z.string().optional().describe("Internal notes. Never shown to clients."),
  },
  handler: async ({ geo_code, ...rest }) => createAccount({ ...rest, ...(geo_code ? { geoCode: geo_code } : {}) }),
});

export const createPersonTool = defineTool({
  name: "create_person",
  description: "Add a person who can own items: Talkpush staff (omit account), or a client contact or vendor (give account).",
  access: "write",
  input: {
    name: z.string(),
    side: z.enum(PERSON_SIDES),
    account: z.string().optional().describe("Account name or id. Required for client and vendor."),
    email: z.string().optional(),
    title: z.string().optional(),
    organisation: z.string().optional().describe("For vendors: their company"),
  },
  handler: async ({ account, ...rest }) =>
    createPerson({ ...rest, accountId: account ? await resolveAccountId(account) : null }),
});

export const createProjectTool = defineTool({
  name: "create_project",
  description:
    "Create a project for an account. It starts with the standard phases (Scoping, Configuration, UAT, Training, Go-live, Hypercare).",
  access: "write",
  input: {
    account: z.string().describe("Account name or id"),
    title: z.string(),
    objective: z.string().optional(),
    start_date: date,
    target_date: date,
    go_live_date: date,
    owner: z.string().optional().describe("Project owner's name"),
    sponsor: z.string().optional().describe("Sponsor's name"),
  },
  handler: async (args, ctx) => {
    const accountId = await resolveAccountId(args.account);
    const people = await listPeople({ accountId });
    const personId = (name?: string) =>
      name ? pick(matchByName(people, name, (p) => p.name), "person", name, (p) => `${p.name} (${p.side})`).id : null;
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
      ctx.actor
    );
  },
});

export const updateProjectTool = defineTool({
  name: "update_project",
  description:
    "Change project details. Moving the target date counts as a reschedule and is shown on the project. Setting health_override needs health_override_note; use 'calculated' to clear it.",
  access: "write",
  input: {
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
  handler: async (args, ctx) => {
    const projectId = await resolveProjectId(args);
    const project = await loadContext(projectId);
    return updateProject(
      projectId,
      {
        title: args.title,
        objective: args.objective,
        status: args.status,
        startDate: args.start_date,
        targetDate: args.target_date,
        goLiveDate: args.go_live_date,
        ownerPersonId: resolvePersonId(project, args.owner),
        sponsorPersonId: resolvePersonId(project, args.sponsor),
        healthOverride:
          args.health_override === undefined ? undefined : args.health_override === "calculated" ? null : args.health_override,
        healthOverrideNote: args.health_override_note,
      },
      ctx.actor
    );
  },
});

export const updatePhaseTool = defineTool({
  name: "update_phase",
  description: "Set a phase's start date, end date or exit criteria.",
  access: "write",
  input: {
    ...projectRef,
    phase: z.string().describe("Phase name, for example UAT"),
    start_date: date,
    end_date: date,
    exit_criteria: z.string().nullable().optional(),
  },
  handler: async ({ phase, start_date, end_date, exit_criteria, ...ref }, ctx) => {
    const project = await loadContext(await resolveProjectId(ref));
    const phaseId = resolvePhaseId(project, phase);
    if (!phaseId) throw badRequest("Give the phase name.");
    return updatePhase(phaseId, { startDate: start_date, endDate: end_date, exitCriteria: exit_criteria }, ctx.actor);
  },
});

export const addPhasesTool = defineTool({
  name: "add_phases",
  description:
    "Add phases to a project, after the ones it already has, in the order given. Use this when a timeline has phases the standard set does not (for example from a Gantt chart). Phase names must be unique in the project; use update_phase to change an existing phase.",
  access: "write",
  input: {
    ...projectRef,
    phases: z
      .array(
        z.object({
          name: z.string().describe("For example Data migration"),
          start_date: date,
          end_date: date,
          exit_criteria: z.string().optional().describe("What must be true to leave this phase"),
        })
      )
      .min(1)
      .max(20),
  },
  handler: async ({ phases, ...ref }, ctx) =>
    createPhases(
      await resolveProjectId(ref),
      phases.map((p) => ({ name: p.name, startDate: p.start_date, endDate: p.end_date, exitCriteria: p.exit_criteria })),
      ctx.actor
    ),
});

// ----- items ---------------------------------------------------------------

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
  blocked_by: z
    .array(z.string())
    .optional()
    .describe("Titles or ids of items this one waits for. May name items created earlier in the same call."),
  jira_links: z.array(z.string()).max(MAX_JIRA_LINKS).optional().describe(JIRA_LINKS_NOTE),
});

export const addOpenItemsTool = defineTool({
  name: "add_open_items",
  description: `Add one or more items to a project. All names are checked before anything is created, so a typo creates nothing. ${VISIBILITY_NOTE}`,
  access: "write",
  input: { ...projectRef, items: z.array(newItem).min(1).max(50) },
  handler: async ({ items, ...ref }, ctx) => {
    const projectId = await resolveProjectId(ref);
    const project = await loadContext(projectId);
    const batchTitles = items.map((i) => ({ id: `batch:${i.title}`, title: i.title }));

    // Resolve everything first, so a bad name stops the whole call before any write.
    const prepared = items.map((it, index) => {
      const ownerPersonId = resolvePersonId(project, it.owner);
      const phaseId = resolvePhaseId(project, it.phase);
      const earlier = batchTitles.slice(0, index);
      const refs = (it.blocked_by ?? []).map((b) => {
        const inBatch = matchByName(earlier, b, (e) => e.title);
        if (inBatch.kind === "one") return inBatch.value.id;
        return resolveItemIds(project, [b])[0];
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
          links: it.jira_links?.map((url) => ({ url })),
        },
        ctx.actor
      );
      createdIds.set(`batch:${it.title}`, item.id);
      created.push(itemOut(item));
    }
    return { created };
  },
});

export const updateItemStatusTool = defineTool({
  name: "update_item_status",
  description: "Change an item's status. Moving to blocked needs blocker_reason. Optionally leave a remark in the same call.",
  access: "write",
  input: {
    ...projectRef,
    ...itemRef,
    status: z.enum(ITEM_STATUSES),
    blocker_reason: z.string().optional(),
    remark: z.string().optional().describe("Optional note to record with the change"),
    remark_visibility: z.enum(REMARK_VISIBILITIES).optional().describe("Defaults to internal"),
  },
  handler: async (args, ctx) => {
    const project = await loadContext(await resolveProjectId(args));
    const target = resolveItem(project, args);
    const updated = await updateItem(target.id, { status: args.status, blockerReason: args.blocker_reason }, ctx.actor);
    if (args.remark) {
      await addRemark(target.id, { body: args.remark, visibility: args.remark_visibility ?? "internal" }, ctx.actor);
    }
    return itemOut(updated);
  },
});

export const updateItemTool = defineTool({
  name: "update_item",
  description:
    "Change an item's details (not its status; use update_item_status for that). Pass null to clear owner, phase or dates.",
  access: "write",
  input: {
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
    jira_links: z
      .array(z.string())
      .max(MAX_JIRA_LINKS)
      .optional()
      .describe(`${JIRA_LINKS_NOTE} This REPLACES the item's whole list, so include the tickets already linked (see jiraLinks in list_open_items). Pass [] to clear.`),
  },
  handler: async (args, ctx) => {
    const project = await loadContext(await resolveProjectId(args));
    const target = resolveItem(project, args);
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
          phaseId: resolvePhaseId(project, args.phase),
          ownerPersonId: resolvePersonId(project, args.owner),
          startDate: args.start_date,
          dueDate: args.due_date,
          waitingOn: args.waiting_on,
          externalDependency: args.external_dependency,
          links: args.jira_links?.map((url) => ({ url })),
        },
        ctx.actor
      )
    );
  },
});

export const addItemRemarkTool = defineTool({
  name: "add_item_remark",
  description: "Add a remark to an item. Internal by default; set visibility 'shared' only for text the client may read.",
  access: "write",
  input: { ...projectRef, ...itemRef, body: z.string(), visibility: z.enum(REMARK_VISIBILITIES).optional() },
  handler: async (args, ctx) => {
    const project = await loadContext(await resolveProjectId(args));
    const target = resolveItem(project, args);
    return addRemark(target.id, { body: args.body, visibility: args.visibility ?? "internal" }, ctx.actor);
  },
});

export const setItemDependencyTool = defineTool({
  name: "set_item_dependency",
  description:
    "Say which items an item is waiting for. mode 'add' (default) adds to the list, 'remove' removes, 'replace' sets the exact list. Loops are rejected.",
  access: "write",
  input: {
    ...projectRef,
    ...itemRef,
    blocked_by: z.array(z.string()).describe("Titles or ids of the items it waits for"),
    mode: z.enum(["add", "remove", "replace"]).optional(),
  },
  handler: async (args, ctx) => {
    const project = await loadContext(await resolveProjectId(args));
    const target = resolveItem(project, args);
    const wanted = resolveItemIds(project, args.blocked_by);
    const current = target.blockedByItemIds;
    const mode = args.mode ?? "add";
    const next =
      mode === "replace"
        ? wanted
        : mode === "remove"
          ? current.filter((id) => !wanted.includes(id))
          : Array.from(new Set([...current, ...wanted]));
    return itemOut(await updateItem(target.id, { blockedByItemIds: next }, ctx.actor));
  },
});

export const archiveItemTool = defineTool({
  name: "archive_item",
  description: "Hide an item from the project. Nothing is deleted: the activity history keeps it.",
  access: "write",
  input: { ...projectRef, ...itemRef },
  handler: async (args, ctx) => {
    const project = await loadContext(await resolveProjectId(args));
    const target = resolveItem(project, args);
    return itemOut(await updateItem(target.id, { archived: true }, ctx.actor));
  },
});

// ----- success metrics -------------------------------------------------------

export const addSuccessMetricTool = defineTool({
  name: "add_success_metric",
  description:
    "Add a success metric with its baseline and target, for example 'Time to hire', 'days', lower_is_better, baseline 21, target 14.",
  access: "write",
  input: {
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
  handler: async (
    { name, unit, direction, baseline_value, baseline_date, target_value, current_value, current_as_of, source, visibility, ...ref },
    ctx
  ) =>
    createMetric(
      await resolveProjectId(ref),
      {
        name,
        unit,
        direction,
        baselineValue: baseline_value,
        baselineDate: baseline_date,
        targetValue: target_value,
        currentValue: current_value,
        currentAsOf: current_as_of,
        source,
        visibility,
      },
      ctx.actor
    ),
});

export const recordMetricReadingTool = defineTool({
  name: "record_metric_reading",
  description: "Record a new measurement for a success metric. The metric's current value follows the newest reading.",
  access: "write",
  input: {
    ...projectRef,
    metric_id: z.string().optional(),
    metric: z.string().optional().describe("Metric name instead of metric_id (needs the project)"),
    value: z.number(),
    as_of: date.describe("Date of the measurement, YYYY-MM-DD. Defaults to today."),
    note: z.string().optional(),
  },
  handler: async ({ metric_id, metric, value, as_of, note, ...ref }, ctx) => {
    let id = metric_id;
    if (!id) {
      if (!metric) throw badRequest("Give a metric_id, or a metric name with the project.");
      const metrics = await listMetrics(await resolveProjectId(ref));
      id = pick(matchByName(metrics, metric, (m) => m.name), "metric", metric, (m) => `${m.name} (${m.id})`).id;
    }
    return recordReading(id, { value, asOf: as_of, note }, ctx.actor);
  },
});

export const trackerWriteTools = [
  createAccountTool,
  createPersonTool,
  createProjectTool,
  updateProjectTool,
  updatePhaseTool,
  addPhasesTool,
  addOpenItemsTool,
  updateItemStatusTool,
  updateItemTool,
  addItemRemarkTool,
  setItemDependencyTool,
  archiveItemTool,
  addSuccessMetricTool,
  recordMetricReadingTool,
];
