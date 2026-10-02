import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "./actor";

export function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Only the keys whose value really changed, as { before, after }. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[]
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return Object.keys(a).length > 0 ? { before: b, after: a } : null;
}

export async function logActivity(
  tx: Prisma.TransactionClient,
  entry: {
    projectId: string;
    entityType: "project" | "phase" | "item" | "remark" | "metric";
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
    actor: Actor;
  }
): Promise<void> {
  await tx.trackerActivity.create({
    data: {
      projectId: entry.projectId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      before: toJson(entry.before),
      after: toJson(entry.after),
      actorLabel: entry.actor.label,
      via: entry.actor.via,
    },
  });
}
