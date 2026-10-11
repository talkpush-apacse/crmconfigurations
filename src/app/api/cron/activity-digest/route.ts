/**
 * Daily activity digest: one email to the super admin named in ACTIVITY_DIGEST_TO, Monday to Friday at 8:00 am Manila
 * time (the schedule is in vercel.json), listing what changed in trackers, workflows and checklists since the last one.
 *
 * Vercel calls this with "Authorization: Bearer <CRON_SECRET>". Optional query parameters, all secret-protected:
 *   ?dryRun=1            build the email and return it, send nothing and record nothing (add &format=html to see it as a page)
 *   ?date=2026-10-08     build the digest for that weekday's 8:00 am slot (to check a day or re-send a missed one)
 *   ?force=1             with ?date=, send again even though that slot was already sent
 *
 * Vercel's scheduler is best effort: a run can be missed or happen twice. Each 8:00 am slot is claimed in the
 * ActivityDigestRun table first (one row per slot), so a duplicate run stops, and the next digest starts where the last
 * completed one ended, so a missed day is caught up. If that table does not exist yet, the digest still sends without
 * those two protections.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendActivityDigest } from "@/lib/email";
import { signInOrigin } from "@/lib/google-sign-in";
import { collectDigest } from "@/lib/activity-digest/collect";
import { cronAuthorised } from "@/lib/activity-digest/cron-auth";
import { buildActivityDigestEmail } from "@/lib/activity-digest/digest-email";
import { summariseArea } from "@/lib/activity-digest/describe";
import { canReceiveDigest } from "@/lib/activity-digest/recipient";
import { claimRun, finishRun, lastCompletedEnd } from "@/lib/activity-digest/run-record";
import type { DigestArea } from "@/lib/activity-digest/types";
import { parseSlotDate, scheduledSlotFor, slotInstant, slotToString, windowStartFor } from "@/lib/activity-digest/window";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AREAS: DigestArea[] = ["tracker", "workflow", "checklist"];

export async function GET(request: NextRequest) {
  // No secret configured means nobody can be trusted, so refuse (the older cron routes would accept "Bearer undefined").
  if (!cronAuthorised(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const force = params.get("force") === "1";

  let slot;
  try {
    slot = params.get("date") ? parseSlotDate(params.get("date") as string) : scheduledSlotFor(new Date());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bad date." }, { status: 400 });
  }
  const windowEnd = slotInstant(slot);
  const slotName = slotToString(slot);

  // Who gets it. The address comes from the setting only, and must be a super admin right now.
  const to = process.env.ACTIVITY_DIGEST_TO?.trim() ?? "";
  if (!to) {
    console.warn("[activity-digest] ACTIVITY_DIGEST_TO is not set, nothing sent");
    return NextResponse.json({ sent: false, reason: "ACTIVITY_DIGEST_TO is not set", slot: slotName });
  }
  const recipient = await prisma.adminUser.findFirst({ where: { email: { equals: to, mode: "insensitive" } }, select: { email: true, role: true, isSuperAdmin: true } });
  if (!canReceiveDigest(recipient)) {
    console.warn("[activity-digest] the ACTIVITY_DIGEST_TO address is not a super admin login, nothing sent");
    return NextResponse.json({ sent: false, reason: "The ACTIVITY_DIGEST_TO address is not a super admin", slot: slotName });
  }

  // Where the window starts: the previous weekday's 8:00 am, or further back if earlier digests were missed.
  const windowStart = windowStartFor(slot, await lastCompletedEnd(windowEnd));

  // Claim the slot, so a duplicate run stops. (A dry run never claims or records anything.)
  let runId: string | null = null;
  let runRecorded = false;
  if (!dryRun) {
    const claim = await claimRun({ windowStart, windowEnd, force });
    if (claim.state === "already_done") return NextResponse.json({ sent: false, reason: `Already ${claim.status} for this slot`, slot: slotName });
    if (claim.state === "in_progress") return NextResponse.json({ sent: false, reason: "Another run is working on this slot", slot: slotName });
    if (claim.state === "claimed") {
      runId = claim.runId;
      runRecorded = true;
    } else {
      console.warn("[activity-digest] the send record table is not available, sending without duplicate and catch-up protection");
    }
  }
  const finish = async (status: "sent" | "skipped" | "failed", changes: number, reason?: string) => {
    if (runId) await finishRun(runId, status, changes, reason);
  };

  try {
    const collected = await collectDigest({ start: windowStart, end: windowEnd });
    if (collected.failedAreas.length === AREAS.length) {
      console.error("[activity-digest] every source failed, nothing sent");
      await finish("failed", 0, "every source failed");
      return NextResponse.json({ sent: false, reason: "Every source failed", slot: slotName }, { status: 500 });
    }
    if (collected.entries.length === 0 && collected.failedAreas.length === 0) {
      await finish("skipped", 0, "no changes");
      return NextResponse.json({ sent: false, reason: "no changes", slot: slotName });
    }

    const appBaseUrl = process.env.APP_BASE_URL?.trim() || signInOrigin(process.env.GOOGLE_REDIRECT_URI?.trim(), "");
    const email = buildActivityDigestEmail({
      areas: AREAS.map((a) => summariseArea(a, collected.entries, recipient!.email)),
      failedAreas: collected.failedAreas,
      notes: collected.notes,
      slot,
      windowStart,
      appBaseUrl,
    });

    const summary = {
      slot: slotName,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      changes: email.totalChanges,
      failedAreas: collected.failedAreas,
      runRecorded,
    };

    if (dryRun) {
      if (params.get("format") === "html") return new Response(email.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      return NextResponse.json({ sent: false, dryRun: true, ...summary, subject: email.subject, html: email.html, text: email.text });
    }

    const result = await sendActivityDigest({ to: recipient!.email, subject: email.subject, html: email.html, text: email.text });
    if (!result.ok) {
      console.error(`[activity-digest] send failed for slot ${slotName}: ${result.error ?? "unknown error"}`);
      await finish("failed", email.totalChanges, "the email could not be sent");
      return NextResponse.json({ sent: false, reason: "The email could not be sent", ...summary }, { status: 502 });
    }
    await finish("sent", email.totalChanges);
    console.info(`[activity-digest] sent slot ${slotName}: ${email.totalChanges} changes`);
    return NextResponse.json({ sent: true, ...summary });
  } catch (err) {
    // Anything unexpected: mark the slot failed so the next run takes it over, then let Vercel's log show the error.
    console.error(`[activity-digest] unexpected error for slot ${slotName}:`, err instanceof Error ? err.message : err);
    await finish("failed", 0, "unexpected error");
    return NextResponse.json({ sent: false, reason: "Unexpected error", slot: slotName }, { status: 500 });
  }
}
