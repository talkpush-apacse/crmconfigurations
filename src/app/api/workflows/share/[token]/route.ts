import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildClientWorkflowDto } from "@/lib/workflow/access/client-view";

// GET — public endpoint to fetch a workflow by share token (no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const workflow = await prisma.workflowProject.findUnique({
      where: { shareToken: token },
      include: {
        feedback: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workflow || !workflow.shareToken) {
      return NextResponse.json(
        { error: "This share link is invalid or has been revoked." },
        { status: 404 }
      );
    }

    let pinnedVersion = null;
    let responseData = workflow;

    if (workflow.shareVersionId) {
      const version = await prisma.workflowVersion.findFirst({
        where: { id: workflow.shareVersionId, workflowId: workflow.id },
        select: {
          versionNumber: true,
          createdAt: true,
          status: true,
          label: true,
          nodes: true,
          edges: true,
          viewport: true,
          pages: true,
        },
      });

      if (version) {
        pinnedVersion = {
          versionNumber: version.versionNumber,
          createdAt: version.createdAt,
          status: version.status,
          label: version.label,
        };

        // Prefer the version's full multi-page snapshot when available; fall
        // back to the legacy single-canvas fields wrapped in a synthetic page.
        const pinnedPages = Array.isArray(version.pages)
          ? version.pages
          : [
              {
                id: `page_${Math.random().toString(36).slice(2, 12)}`,
                name: "Page 1",
                nodes: version.nodes,
                edges: version.edges,
                viewport: version.viewport ?? workflow.viewport,
              },
            ];

        responseData = {
          ...workflow,
          nodes: version.nodes,
          edges: version.edges,
          viewport: version.viewport ?? workflow.viewport,
          pages: pinnedPages,
        };
      }
    }

    // F2/F3: send clients an allow-listed, client-safe copy, never the raw database row.
    return NextResponse.json(
      buildClientWorkflowDto(responseData, workflow.feedback, pinnedVersion, { showFeasibility: workflow.showFeasibility })
    );
  } catch (err) {
    console.error("GET /api/workflows/share/[token] error:", err);
    return NextResponse.json(
      { error: "Failed to load workflow" },
      { status: 500 }
    );
  }
}
