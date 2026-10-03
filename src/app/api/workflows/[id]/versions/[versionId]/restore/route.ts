import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { createVersionSnapshot } from "@/lib/workflow/versioning";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, versionId } = await params;

    const targetVersion = await prisma.workflowVersion.findFirst({
      where: { id: versionId, workflowId: id },
    });

    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    await createVersionSnapshot({
      workflowId: id,
      triggeredBy: "restore",
      triggerDetail: `Auto-saved before restoring v${targetVersion.versionNumber}`,
    });

    // Prefer the multi-page snapshot when present; fall back to legacy
    // single-canvas fields by wrapping them in a synthetic "Page 1".
    const restoredPages = Array.isArray(targetVersion.pages)
      ? (targetVersion.pages as unknown[])
      : [
          {
            id: `page_${Math.random().toString(36).slice(2, 12)}`,
            name: "Page 1",
            nodes: targetVersion.nodes ?? [],
            edges: targetVersion.edges ?? [],
            viewport: targetVersion.viewport ?? { x: 0, y: 0, zoom: 1 },
          },
        ];

    const firstRestoredPage = restoredPages[0] as
      | { nodes?: unknown; edges?: unknown; viewport?: unknown }
      | undefined;

    await prisma.workflowProject.update({
      where: { id },
      data: {
        pages: structuredClone(restoredPages) as unknown as Prisma.InputJsonValue,
        nodes: (firstRestoredPage?.nodes as object) ?? targetVersion.nodes ?? [],
        edges: (firstRestoredPage?.edges as object) ?? targetVersion.edges ?? [],
        viewport:
          (firstRestoredPage?.viewport as object) ??
          targetVersion.viewport ??
          undefined,
        revision: { increment: 1 },
      },
    });

    await createVersionSnapshot({
      workflowId: id,
      triggeredBy: "restore",
      triggerDetail: `Restored from v${targetVersion.versionNumber}`,
      label: targetVersion.label ?? undefined,
    });

    const updated = await prisma.workflowProject.findUnique({
      where: { id },
      include: {
        feedback: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/workflows/[id]/versions/[versionId]/restore error:", err);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
