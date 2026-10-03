import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { createVersionSnapshot } from "@/lib/workflow/versioning";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        label: true,
        status: true,
        triggeredBy: true,
        triggerDetail: true,
        createdByName: true,
        nodeCount: true,
        edgeCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ items: versions });
  } catch (err) {
    console.error("GET /api/workflows/[id]/versions error:", err);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const version = await createVersionSnapshot({
      workflowId: id,
      triggeredBy: "manual",
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : undefined,
      createdByName:
        typeof body.createdByName === "string" && body.createdByName.trim()
          ? body.createdByName.trim()
          : undefined,
    });

    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    console.error("POST /api/workflows/[id]/versions error:", err);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
