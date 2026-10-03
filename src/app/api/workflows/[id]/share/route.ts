import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { nanoid } from "@/lib/workflow/ids";
import { createVersionSnapshot } from "@/lib/workflow/versioning";

async function isValidShareVersionId(workflowId: string, shareVersionId: string) {
  const version = await prisma.workflowVersion.findFirst({
    where: { id: shareVersionId, workflowId },
    select: { id: true },
  });

  return Boolean(version);
}

// POST — generate a share token and mark workflow as "shared"
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    let shareVersionId: string | null = null;
    let shouldUpdateShareVersion = false;

    try {
      const body = await request.json();
      if (Object.prototype.hasOwnProperty.call(body, "shareVersionId")) {
        shouldUpdateShareVersion = true;
        shareVersionId = body.shareVersionId ?? null;
      }
    } catch {
      // Empty body is allowed.
    }

    const existing = await prisma.workflowProject.findUnique({
      where: { id },
      select: { id: true, shareToken: true, shareVersionId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (
      shouldUpdateShareVersion &&
      shareVersionId &&
      !(await isValidShareVersionId(id, shareVersionId))
    ) {
      return NextResponse.json(
        { error: "Selected version does not belong to this workflow." },
        { status: 400 }
      );
    }

    if (existing.status !== "shared") {
      try {
        await createVersionSnapshot({
          workflowId: id,
          triggeredBy: "status_change",
          triggerDetail: `${existing.status} → shared`,
        });
      } catch (snapErr) {
        console.error("Version snapshot failed (non-blocking):", snapErr);
      }
    }

    // Reuse existing token if already shared
    const token = existing.shareToken ?? nanoid(12);

    const updated = await prisma.workflowProject.update({
      where: { id },
      data: {
        shareToken: token,
        status: "shared",
        ...(shouldUpdateShareVersion
          ? { shareVersionId }
          : { shareVersionId: existing.shareVersionId }),
      },
      select: { shareVersionId: true },
    });

    const baseUrl = request.nextUrl.origin;
    return NextResponse.json({
      shareToken: token,
      shareUrl: `${baseUrl}/w/${token}`,
      shareVersionId: updated.shareVersionId,
    });
  } catch (err) {
    console.error("POST /api/workflows/[id]/share error:", err);
    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 });
  }
}

// PUT — update share settings (e.g. pin/unpin version)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const shareVersionId = body.shareVersionId ?? null;

    if (
      shareVersionId &&
      !(await isValidShareVersionId(id, shareVersionId))
    ) {
      return NextResponse.json(
        { error: "Selected version does not belong to this workflow." },
        { status: 400 }
      );
    }

    const updated = await prisma.workflowProject.update({
      where: { id },
      data: { shareVersionId },
      select: { id: true, shareVersionId: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/workflows/[id]/share error:", err);
    return NextResponse.json(
      { error: "Failed to update share settings" },
      { status: 500 }
    );
  }
}

// DELETE — revoke share token and reset status to draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const existing = await prisma.workflowProject.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      try {
        await createVersionSnapshot({
          workflowId: id,
          triggeredBy: "status_change",
          triggerDetail: `${existing.status} → draft`,
        });
      } catch (snapErr) {
        console.error("Version snapshot failed (non-blocking):", snapErr);
      }
    }

    await prisma.workflowProject.update({
      where: { id },
      data: { shareToken: null, status: "draft", shareVersionId: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/workflows/[id]/share error:", err);
    return NextResponse.json({ error: "Failed to revoke share link" }, { status: 500 });
  }
}
