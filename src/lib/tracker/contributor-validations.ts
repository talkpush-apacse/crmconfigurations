import { z } from "zod";
import { PRIORITIES } from "./constants";
import { isDateOnly } from "./dates";

/**
 * What a client contact may send through their private link. Every schema is strict:
 * a field that is not listed here (visibility, owner, type, phase, milestone, start date...)
 * is refused, not ignored, so a client can never set it.
 */

/** The only statuses a client may set. They cannot set "blocked" or "dropped" (those stay with Talkpush). Going back to "not started" lets them undo a mistake. */
export const CLIENT_STATUSES = ["not_started", "in_progress", "waiting_on_client", "done"] as const;

/** Per-contact safety limits, counted over the last 24 hours. */
export const CLIENT_LIMITS = {
  newItemsPerDay: 20,
  changesPerDay: 100,
  maxWaitsOn: 5,
  maxDueDaysAhead: 730,
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));
const id = z.string().trim().min(1).max(64);

const dueDate = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => v === undefined || v === null || v === "" || isDateOnly(v), "Use a real date (YYYY-MM-DD)")
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

export const clientItemCreateSchema = z
  .object({
    title: text(200),
    description: optionalText(2000),
    priority: z.enum(PRIORITIES).default("medium"),
    dueDate,
    /** Existing client-visible items this one has to wait for. */
    waitsOn: z.array(id).max(CLIENT_LIMITS.maxWaitsOn).default([]),
  })
  .strict();

/** A date in an edit: absent stays absent (unchanged), empty clears it. */
const editDate = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => v === undefined || v === null || v === "" || isDateOnly(v), "Use a real date (YYYY-MM-DD)")
  .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/**
 * A client contact edits an item. Only these fields, never visibility, type, phase, milestone, blocker or links:
 * a field that is not listed is refused. `expectedUpdatedAt` is the time the person last saw the item; if someone has
 * changed it since, the edit is refused so nobody silently overwrites a colleague.
 */
export const clientItemEditSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ message: "Reload the page and try again." }).optional(),
    title: text(200).optional(),
    description: optionalText(2000),
    status: z.enum(CLIENT_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    startDate: editDate,
    dueDate: editDate,
    /** Only another client contact on this account, or nobody. */
    ownerPersonId: id.nullable().optional(),
    /** The visible items this one waits for. Replaces the visible part of its list. */
    waitsOn: z.array(id).max(CLIENT_LIMITS.maxWaitsOn).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).some((k) => k !== "expectedUpdatedAt" && (v as Record<string, unknown>)[k] !== undefined), "Change at least one thing.");

/** The previous name, kept so older callers still compile. */
export const clientItemUpdateSchema = clientItemEditSchema;

export const clientRemarkSchema = z.object({ body: text(1000) }).strict();

/** Staff: create a contributor link for one client contact. */
export const contributorLinkCreateSchema = z.object({
  personId: id,
  label: optionalText(120),
  /** Omitted = 90 days. */
  expiresInDays: z.number().int().min(1).max(365).default(90),
  /** Also give this contact every unassigned "Client does this" item from the standard plan. */
  assignUnassigned: z.boolean().default(false),
});
