/**
 * Daily activity digest: one email to the super admin named in ACTIVITY_DIGEST_TO, Monday to Friday at 8:00 am Manila
 * time (the schedule is in vercel.json), listing what changed in trackers, workflows and checklists since the last one.
 *
 * Vercel calls this with "Authorization: Bearer <CRON_SECRET>". Two optional query parameters, both secret-protected:
 *   ?dryRun=1            build the email and return it, send nothing (add &format=html to see it as a page)
 *   ?date=2026-10-08     build the digest for that weekday's 8:00 am slot (to check a day or re-send a missed one)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendActivityDigest } from "@/lib/email";
import { signInOrigin } from "@/lib/google-sign-in";
import { collectDigest } from "@/lib/activity-digest/collect";
import { buildActivityDigestEmail } from "@/lib/activity-digest/digest-email";
import { summariseArea } from "@/lib/activity-digest/describe";
import { cronAuthorised } from "@/lib/activity-digest/cron-auth";
import { canReceiveDigest } from "@/lib/activity-digest/recipient";
import type { DigestArea } from "@/lib/activity-digest/types";
import { parseSlotDate, scheduledSlotFor, slotToString, windowFor } from "@/lib/activity-digest/window";

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

  let slot;
  try {
    slot = params.get("date") ? parseSlotDate(params.get("date") as string) : scheduledSlotFor(new Date());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bad date." }, { status: 400 });
  }
  const window = windowFor(slot);
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

  const collected = await collectDigest(window);
  if (collected.failedAreas.length === AREAS.length) {
    console.error("[activity-digest] every source failed, nothing sent");
    return NextResponse.json({ sent: false, reason: "Every source failed", slot: slotName }, { status: 500 });
  }
  if (collected.entries.length === 0 && collected.failedAreas.length === 0) {
    return NextResponse.json({ sent: false, reason: "no changes", slot: slotName });
  }

  const appBaseUrl = process.env.APP_BASE_URL?.trim() || signInOrigin(process.env.GOOGLE_REDIRECT_URI?.trim(), "");
  const email = buildActivityDigestEmail({
    areas: AREAS.map((a) => summariseArea(a, collected.entries, recipient!.email)),
    failedAreas: collected.failedAreas,
    notes: collected.notes,
    slot,
    appBaseUrl,
  });

  const summary = {
    slot: slotName,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    changes: email.totalChanges,
    failedAreas: collected.failedAreas,
  };

  if (dryRun) {
    if (params.get("format") === "html") return new Response(email.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return NextResponse.json({ sent: false, dryRun: true, ...summary, subject: email.subject, html: email.html, text: email.text });
  }

  const result = await sendActivityDigest({ to: recipient!.email, subject: email.subject, html: email.html, text: email.text });
  if (!result.ok) {
    console.error(`[activity-digest] send failed for slot ${slotName}: ${result.error ?? "unknown error"}`);
    return NextResponse.json({ sent: false, reason: "The email could not be sent", ...summary }, { status: 502 });
  }
  console.info(`[activity-digest] sent slot ${slotName}: ${email.totalChanges} changes`);
  return NextResponse.json({ sent: true, ...summary });
}
