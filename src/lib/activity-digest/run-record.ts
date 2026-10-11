import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { decideClaim } from "./claim-rules";

/**
 * The send record (ActivityDigestRun). Thin on purpose: every rule lives in claim-rules.ts and window.ts, which are tested
 * without a database. Nothing here ever stores an address, a name, or any text from a change.
 *
 * If the table does not exist yet (the SQL has not been applied), claiming says "unavailable" and the digest carries on
 * without the duplicate and catch-up protection, so deploying before the SQL can never stop the email.
 */

export type RunStatus = "sending" | "sent" | "skipped" | "failed";

export type Claim =
  | { state: "claimed"; runId: string }
  | { state: "already_done"; status: string }
  | { state: "in_progress" }
  | { state: "unavailable" };

/** Prisma reports a missing table as P2021 (and some paths pass through the raw Postgres code 42P01). */
export function isMissingTable(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "42P01";
}

const isUniqueConflict = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** When did the last digest that went out (or was skipped for a quiet day) end? null if none, or if the table is missing. */
export async function lastCompletedEnd(before: Date): Promise<Date | null> {
  try {
    const row = await prisma.activityDigestRun.findFirst({
      where: { status: { in: ["sent", "skipped"] }, windowEnd: { lt: before } },
      orderBy: { windowEnd: "desc" },
      select: { windowEnd: true },
    });
    return row?.windowEnd ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/** Try to be the one run that sends this slot. The unique windowEnd makes the database the referee. */
export async function claimRun(args: { windowStart: Date; windowEnd: Date; force: boolean; now?: Date }): Promise<Claim> {
  const now = args.now ?? new Date();
  try {
    const created = await prisma.activityDigestRun.create({ data: { windowStart: args.windowStart, windowEnd: args.windowEnd, status: "sending", startedAt: now }, select: { id: true } });
    return { state: "claimed", runId: created.id };
  } catch (err) {
    if (isMissingTable(err)) return { state: "unavailable" };
    if (!isUniqueConflict(err)) throw err;
  }

  const existing = await prisma.activityDigestRun.findUnique({ where: { windowEnd: args.windowEnd }, select: { id: true, status: true, startedAt: true } });
  if (!existing) return { state: "in_progress" }; // it vanished between the two steps; do nothing rather than guess
  const decision = decideClaim(existing, now, args.force);
  if (decision === "already_done") return { state: "already_done", status: existing.status };
  if (decision === "in_progress") return { state: "in_progress" };

  // Take it over, but only if nobody else has changed it since we looked (status AND startedAt must still match).
  const taken = await prisma.activityDigestRun.updateMany({
    where: { id: existing.id, status: existing.status, startedAt: existing.startedAt },
    data: { status: "sending", windowStart: args.windowStart, startedAt: now, finishedAt: null, reason: null, changeCount: 0 },
  });
  return taken.count === 1 ? { state: "claimed", runId: existing.id } : { state: "in_progress" };
}

/** Record how a claimed run ended. Never throws: the email has already been dealt with by now. One retry. */
export async function finishRun(runId: string, status: Exclude<RunStatus, "sending">, changeCount: number, reason?: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await prisma.activityDigestRun.updateMany({ where: { id: runId, status: "sending" }, data: { status, changeCount, reason: reason ?? null, finishedAt: new Date() } });
      return;
    } catch (err) {
      console.error(`[activity-digest] could not record the run result (attempt ${attempt}):`, err instanceof Error ? err.message : err);
    }
  }
}
