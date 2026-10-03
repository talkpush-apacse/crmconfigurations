import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { createVersionSnapshot } from "@/lib/workflow/versioning";
import { sanitizeText } from "@/lib/workflow/text";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
      include: {
        feedback: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (err) {
    console.error("GET /api/workflows/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const hasCanvasUpdate =
      body.diagramStyle !== undefined ||
      body.nodes !== undefined ||
      body.edges !== undefined ||
      body.viewport !== undefined ||
      body.pages !== undefined;

    const current = await prisma.workflowProject.findUnique({
      where: { id },
      select: { status: true, revision: true },
    });

    // Saving on top of a newer version someone else saved would silently erase their work: refuse (409) and let the
    // editor show a conflict message. Callers that do not send baseRevision keep the old last-save-wins behaviour.
    const baseRevision = typeof body.baseRevision === "number" ? body.baseRevision : null;
    if (hasCanvasUpdate && baseRevision !== null && current && current.revision !== baseRevision) {
      return NextResponse.json(
        { error: "This workflow changed since you opened it.", code: "conflict", latestRevision: current.revision },
        { status: 409 }
      );
    }

    if (body.status !== undefined) {
      if (current && current.status !== body.status) {
        try {
          await createVersionSnapshot({
            workflowId: id,
            triggeredBy: "status_change",
            triggerDetail: `${current.status} → ${body.status}`,
          });
        } catch (snapErr) {
          console.error("Version snapshot failed (non-blocking):", snapErr);
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (body.workflowName !== undefined) {
      data.workflowName =
        typeof body.workflowName === "string"
          ? sanitizeText(body.workflowName)
          : body.workflowName;
    }
    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string"
          ? sanitizeText(body.description)
          : body.description;
    }
    if (body.status !== undefined) data.status = body.status;
    if (body.diagramStyle !== undefined) {
      if (body.diagramStyle !== "classic" && body.diagramStyle !== "process_map") {
        return NextResponse.json({ error: "diagramStyle must be classic or process_map" }, { status: 400 });
      }
      data.diagramStyle = body.diagramStyle;
      data.numberingScheme = body.diagramStyle === "process_map" ? "decimal" : "letters";
    }
    if (body.nodes !== undefined)
      data.nodes = structuredClone(body.nodes);
    if (body.edges !== undefined)
      data.edges = structuredClone(body.edges);
    if (body.viewport !== undefined)
      data.viewport = structuredClone(body.viewport);

    // Multi-page save: persist the full pages array and mirror the FIRST
    // page's nodes/edges/viewport into the legacy columns so older code paths
    // (and pre-pages versions) keep rendering something sensible.
    if (body.pages !== undefined && Array.isArray(body.pages)) {
      const pages = structuredClone(body.pages) as Array<{
        id?: string;
        name?: string;
        nodes?: unknown[];
        edges?: unknown[];
        viewport?: unknown;
      }>;
      data.pages = pages;
      const firstPage = pages[0];
      if (firstPage) {
        if (body.nodes === undefined) data.nodes = firstPage.nodes ?? [];
        if (body.edges === undefined) data.edges = firstPage.edges ?? [];
        if (body.viewport === undefined)
          data.viewport = firstPage.viewport ?? { x: 0, y: 0, zoom: 1 };
      }
    }

    if (hasCanvasUpdate) {
      data.revision = { increment: 1 };
      // An approval stops being true the moment the diagram changes (spec F5).
      if (body.status === undefined && current?.status === "approved") data.status = "modified_since_approval";
    }

    const selectFields = { id: true, updatedAt: true, currentVersion: true, pages: true, revision: true, status: true } as const;

    let updated;
    if (hasCanvasUpdate && baseRevision !== null) {
      // Compare-and-swap: only writes if nobody saved between the check above and now.
      const swapped = await prisma.workflowProject.updateMany({ where: { id, revision: baseRevision }, data });
      if (swapped.count === 0) {
        const latest = await prisma.workflowProject.findUnique({ where: { id }, select: { revision: true } });
        return NextResponse.json(
          { error: "This workflow changed since you opened it.", code: "conflict", latestRevision: latest?.revision ?? baseRevision + 1 },
          { status: 409 }
        );
      }
      updated = await prisma.workflowProject.findUniqueOrThrow({ where: { id }, select: selectFields });
    } else {
      updated = await prisma.workflowProject.update({ where: { id }, data, select: selectFields });
    }

    if (hasCanvasUpdate) {
      const versionCount = await prisma.workflowVersion.count({
        where: { workflowId: id },
      });

      if (versionCount === 0) {
        try {
          await createVersionSnapshot({
            workflowId: id,
            triggeredBy: "manual",
            triggerDetail: "Initial version",
          });

          const refreshed = await prisma.workflowProject.findUnique({
            where: { id },
            select: selectFields,
          });

          if (refreshed) {
            updated = refreshed;
          }
        } catch (snapErr) {
          console.error("Initial version seed failed (non-blocking):", snapErr);
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/workflows/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    await prisma.workflowProject.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/workflows/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
