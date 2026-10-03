import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { createVersionSnapshot } from "@/lib/workflow/versioning";
import { sanitizeText } from "@/lib/workflow/text";

const FEEDBACK_RATE_LIMIT_MAX = 3;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FEEDBACK_RATE_LIMIT_MAX_ENTRIES = 500;
const feedbackRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function constantTimeStringEqual(a: string, b: string): boolean {
  // Hash first so timingSafeEqual always receives fixed-length buffers.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function checkFeedbackRateLimit(workflowId: string): number | null {
  const now = Date.now();
  const entry = feedbackRateLimitMap.get(workflowId);

  if (!entry || now > entry.resetAt) {
    feedbackRateLimitMap.delete(workflowId);
    feedbackRateLimitMap.set(workflowId, {
      count: 1,
      resetAt: now + FEEDBACK_RATE_LIMIT_WINDOW_MS,
    });
    pruneFeedbackRateLimitMap(now);
    return null;
  }

  const updated = { count: entry.count + 1, resetAt: entry.resetAt };
  feedbackRateLimitMap.delete(workflowId);
  feedbackRateLimitMap.set(workflowId, updated);
  pruneFeedbackRateLimitMap(now);

  if (updated.count > FEEDBACK_RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((updated.resetAt - now) / 1000));
  }

  return null;
}

function pruneFeedbackRateLimitMap(now: number): void {
  for (const [key, entry] of feedbackRateLimitMap) {
    if (now > entry.resetAt) {
      feedbackRateLimitMap.delete(key);
    }
  }

  while (feedbackRateLimitMap.size > FEEDBACK_RATE_LIMIT_MAX_ENTRIES) {
    const oldestKey = feedbackRateLimitMap.keys().next().value;
    if (oldestKey === undefined) break;
    feedbackRateLimitMap.delete(oldestKey);
  }
}

// POST — submit sign-off feedback from the public shared view (no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { action, reviewerName, comment, shareToken } = body;
    const sanitizedReviewerName =
      typeof reviewerName === "string" ? sanitizeText(reviewerName) : "";
    const sanitizedComment =
      typeof comment === "string" ? sanitizeText(comment) : "";

    if (!action || !["approved", "changes_requested"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!sanitizedReviewerName) {
      return NextResponse.json({ error: "Reviewer name is required" }, { status: 400 });
    }

    if (!shareToken || typeof shareToken !== "string" || !shareToken.trim()) {
      return NextResponse.json(
        { error: "A valid share token is required to submit feedback." },
        { status: 400 }
      );
    }

    if (
      action === "changes_requested" &&
      !sanitizedComment
    ) {
      return NextResponse.json(
        { error: "A comment is required when requesting changes." },
        { status: 400 }
      );
    }

    // Verify workflow exists and is shared
    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
      select: { id: true, shareToken: true, status: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (!workflow.shareToken) {
      return NextResponse.json({ error: "Workflow is not shared" }, { status: 403 });
    }

    const retryAfter = checkFeedbackRateLimit(id);
    if (retryAfter) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please try again later." },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      );
    }

    if (!constantTimeStringEqual(shareToken.trim(), workflow.shareToken)) {
      return NextResponse.json(
        { error: "This share link is no longer valid for feedback submission." },
        { status: 403 }
      );
    }

    if (workflow.status !== action) {
      try {
        await createVersionSnapshot({
          workflowId: id,
          triggeredBy: "status_change",
          triggerDetail: `${workflow.status} → ${action}`,
          createdByName: sanitizedReviewerName,
        });
      } catch (snapErr) {
        console.error("Version snapshot failed (non-blocking):", snapErr);
      }
    }

    // Create feedback record and update workflow status in one transaction
    const [feedback] = await prisma.$transaction([
      prisma.workflowFeedback.create({
        data: {
          workflowId: id,
          action,
          reviewerName: sanitizedReviewerName,
          comment: sanitizedComment || null,
        },
      }),
      prisma.workflowProject.update({
        where: { id },
        data: { status: action },
      }),
    ]);

    return NextResponse.json(feedback, { status: 201 });
  } catch (err) {
    console.error("POST /api/workflows/[id]/feedback error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
