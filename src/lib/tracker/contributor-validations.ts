import { z } from "zod";
import { PRIORITIES } from "./constants";
import { isDateOnly } from "./dates";

/**
 * What a client contact may send through their private link. Every schema is strict:
 * a field that is not listed here (visibility, owner, type, phase, milestone, start date...)
 * is refused, not ignored, so a client can never set it.
 */

/** The only statuses a client may set. They cannot set "blocked", "dropped" or go back to "not started". */
export const CLIENT_STATUSES = ["in_progress", "waiting_on_client", "done"] as const;

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

export const clientItemUpdateSchema = z.object({ status: z.enum(CLIENT_STATUSES) }).strict();

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
