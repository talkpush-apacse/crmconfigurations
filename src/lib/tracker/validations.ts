import { z } from "zod";
import {
  HEALTH_LEVELS,
  ITEM_STATUSES,
  ITEM_TYPES,
  ITEM_VISIBILITIES,
  PERSON_SIDES,
  PRIORITIES,
  PROJECT_STATUSES,
  REMARK_VISIBILITIES,
} from "./constants";
import { isDateOnly } from "./dates";
import { MAX_JIRA_LINKS, parseJiraUrl, type JiraLink } from "./jira";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/** "YYYY-MM-DD", empty string or null (= clear). Undefined = leave unchanged. */
const dateField = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => v === undefined || v === null || v === "" || isDateOnly(v), "Use a real date (YYYY-MM-DD)")
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

const id = z.string().trim().min(1).max(64);

export const accountCreateSchema = z.object({
  name: text(120),
  notes: optionalText(2000),
});
export const accountUpdateSchema = z.object({
  name: text(120).optional(),
  notes: optionalText(2000),
  archived: z.boolean().optional(),
});

export const personCreateSchema = z.object({
  accountId: id.nullish().transform((v) => v ?? null),
  side: z.enum(PERSON_SIDES),
  name: text(120),
  email: optionalText(200),
  title: optionalText(120),
  organisation: optionalText(160),
  adminUserId: id.nullish().transform((v) => v ?? null),
});
export const personUpdateSchema = z.object({
  name: text(120).optional(),
  email: optionalText(200),
  title: optionalText(120),
  organisation: optionalText(160),
  archived: z.boolean().optional(),
});

export const projectCreateSchema = z.object({
  accountId: id,
  title: text(160),
  objective: optionalText(2000),
  startDate: dateField,
  targetDate: dateField,
  goLiveDate: dateField,
  sponsorPersonId: id.nullish().transform((v) => v ?? null),
  ownerPersonId: id.nullish().transform((v) => v ?? null),
  checklistId: id.nullish().transform((v) => v ?? null),
});
export const projectUpdateSchema = z.object({
  title: text(160).optional(),
  objective: optionalText(2000),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: dateField,
  targetDate: dateField,
  goLiveDate: dateField,
  sponsorPersonId: id.nullable().optional(),
  ownerPersonId: id.nullable().optional(),
  healthOverride: z.enum(HEALTH_LEVELS).nullish(),
  healthOverrideNote: optionalText(500),
  archived: z.boolean().optional(),
});

export const phaseCreateSchema = z.object({
  name: text(80),
  startDate: dateField,
  endDate: dateField,
  exitCriteria: optionalText(1000),
});

export const phaseUpdateSchema = z.object({
  name: text(80).optional(),
  startDate: dateField,
  endDate: dateField,
  exitCriteria: optionalText(1000),
});

/**
 * An item's links are Talkpush Jira tickets and nothing else (see jira.ts). The label is always rebuilt from the
 * address, so the ticket key shown is the one the link really goes to. Repeats of the same ticket are dropped.
 */
const jiraLinkSchema = z
  .object({ url: z.string().max(500), label: z.string().max(120).optional() })
  .transform((value, ctx): JiraLink => {
    const parsed = parseJiraUrl(value.url);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.error, path: ["url"] });
      return z.NEVER;
    }
    return parsed.link;
  });
const jiraLinksSchema = z
  .array(jiraLinkSchema)
  .max(MAX_JIRA_LINKS)
  .transform((links) => links.filter((l, i) => links.findIndex((x) => x.url === l.url) === i));

export const itemCreateSchema = z.object({
  title: text(200),
  description: optionalText(4000),
  type: z.enum(ITEM_TYPES).default("config"),
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.enum(ITEM_STATUSES).default("not_started"),
  visibility: z.enum(ITEM_VISIBILITIES).default("client_visible"),
  isMilestone: z.boolean().default(false),
  phaseId: id.nullish().transform((v) => v ?? null),
  ownerPersonId: id.nullish().transform((v) => v ?? null),
  startDate: dateField,
  dueDate: dateField,
  blockerReason: optionalText(500),
  waitingOn: optionalText(200),
  externalDependency: optionalText(300),
  links: jiraLinksSchema.optional(),
  checklistTabSlug: optionalText(80),
  blockedByItemIds: z.array(id).max(50).optional(),
});

export const itemUpdateSchema = z.object({
  title: text(200).optional(),
  description: optionalText(4000),
  type: z.enum(ITEM_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  visibility: z.enum(ITEM_VISIBILITIES).optional(),
  isMilestone: z.boolean().optional(),
  phaseId: id.nullable().optional(),
  ownerPersonId: id.nullable().optional(),
  startDate: dateField,
  dueDate: dateField,
  blockerReason: optionalText(500),
  waitingOn: optionalText(200),
  externalDependency: optionalText(300),
  links: jiraLinksSchema.optional(),
  checklistTabSlug: optionalText(80),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  blockedByItemIds: z.array(id).max(50).optional(),
  archived: z.boolean().optional(),
});

export const remarkCreateSchema = z.object({
  body: text(4000),
  visibility: z.enum(REMARK_VISIBILITIES).default("internal"),
});

export const metricCreateSchema = z.object({
  name: text(160),
  unit: text(40),
  direction: z.enum(["higher_is_better", "lower_is_better"]).default("higher_is_better"),
  baselineValue: z.number().finite().nullish().transform((v) => v ?? null),
  baselineDate: dateField,
  targetValue: z.number().finite().nullish().transform((v) => v ?? null),
  currentValue: z.number().finite().nullish().transform((v) => v ?? null),
  currentAsOf: dateField,
  source: optionalText(300),
  visibility: z.enum(ITEM_VISIBILITIES).default("client_visible"),
});

export const metricUpdateSchema = z.object({
  name: text(160).optional(),
  unit: text(40).optional(),
  direction: z.enum(["higher_is_better", "lower_is_better"]).optional(),
  baselineValue: z.number().finite().nullable().optional(),
  baselineDate: dateField,
  targetValue: z.number().finite().nullable().optional(),
  source: optionalText(300),
  visibility: z.enum(ITEM_VISIBILITIES).optional(),
  archived: z.boolean().optional(),
});

export const shareLinkCreateSchema = z.object({
  kind: z.literal("viewer").default("viewer"),
  label: optionalText(120),
  /** Omitted = 90 days. An explicit null means "never expires". */
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});

export const readingCreateSchema = z.object({
  value: z.number().finite(),
  asOf: dateField,
  note: optionalText(500),
});

export const orderSchema = z.object({ itemIds: z.array(id).min(1).max(1000) });

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;
