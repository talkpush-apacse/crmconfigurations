import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { sanitizeText } from "@/lib/workflow/text";

const MAX_LABEL_LENGTH = 80;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, versionId } = await params;

    const version = await prisma.workflowVersion.findFirst({
      where: { id: versionId, workflowId: id },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json(version);
  } catch (err) {
    console.error("GET /api/workflows/[id]/versions/[versionId] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch version" },
      { status: 500 }
    );
  }
}

/** Renames one version. Only the label changes; an empty label clears the name. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, versionId } = await params;
    const body = await request.json().catch(() => ({}));

    if (typeof body.label !== "string") {
      return NextResponse.json({ error: "A label is required" }, { status: 400 });
    }

    const label = sanitizeText(body.label);
    if (label.length > MAX_LABEL_LENGTH) {
      return NextResponse.json(
        { error: `Name must be ${MAX_LABEL_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const existing = await prisma.workflowVersion.findFirst({
      where: { id: versionId, workflowId: id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const version = await prisma.workflowVersion.update({
      where: { id: versionId },
      data: { label: label || null },
      select: { id: true, versionNumber: true, label: true },
    });

    return NextResponse.json(version);
  } catch (err) {
    console.error("PATCH /api/workflows/[id]/versions/[versionId] error:", err);
    return NextResponse.json(
      { error: "Failed to rename version" },
      { status: 500 }
    );
  }
}
