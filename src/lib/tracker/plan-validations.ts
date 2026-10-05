import { z } from "zod";
import { DEFAULT_PHASES, ITEM_TYPES, PLAN_AUDIENCES, PRIORITIES } from "./constants";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

/** A working-day number (1 = first working day of the project). */
const day = z.number().int().min(1).max(200);
const key = z.string().trim().min(1).max(80);

const windowOk = (v: { startDay?: number | null; endDay?: number | null }) =>
  v.startDay === undefined ||
  v.startDay === null ||
  v.endDay === undefined ||
  v.endDay === null ||
  v.endDay >= v.startDay;
const WINDOW_MESSAGE = "The end day cannot be before the start day.";

export const planItemCreateSchema = z
  .object({
    phaseName: z.enum(DEFAULT_PHASES),
    groupName: text(80),
    title: text(200),
    description: optionalText(2000),
    type: z.enum(ITEM_TYPES).default("config"),
    priority: z.enum(PRIORITIES).default("medium"),
    audience: z.enum(PLAN_AUDIENCES).default("shared"),
    isMilestone: z.boolean().default(false),
    defaultIncluded: z.boolean().default(true),
    startDay: day.nullish().transform((v) => v ?? null),
    endDay: day.nullish().transform((v) => v ?? null),
    dependsOnKeys: z.array(key).max(30).default([]),
  })
  .refine(windowOk, { message: WINDOW_MESSAGE, path: ["endDay"] });

export const planItemUpdateSchema = z
  .object({
    phaseName: z.enum(DEFAULT_PHASES).optional(),
    groupName: text(80).optional(),
    title: text(200).optional(),
    description: optionalText(2000),
    type: z.enum(ITEM_TYPES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    audience: z.enum(PLAN_AUDIENCES).optional(),
    isMilestone: z.boolean().optional(),
    defaultIncluded: z.boolean().optional(),
    startDay: day.nullable().optional(),
    endDay: day.nullable().optional(),
    dependsOnKeys: z.array(key).max(30).optional(),
    archived: z.boolean().optional(),
  })
  .refine(windowOk, { message: WINDOW_MESSAGE, path: ["endDay"] });

export const applyPlanSchema = z.object({
  /** The keys of every plan item that should be in the project afterwards. */
  selectedKeys: z.array(key).max(500),
  /** Confirm that items work has already started on may be archived. */
  allowStarted: z.boolean().default(false),
});
