import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getCanvas } from "@/lib/workflow/helpers";
import {
  createScopingArtifact,
  generateCustomerSummaryText,
  listScopingArtifacts,
} from "@/lib/workflow/scoping";
import { validateWorkflow } from "@/lib/workflow/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
      select: {
        id: true,
        clientName: true,
        workflowName: true,
        nodes: true,
        edges: true,
        pages: true,
        viewport: true,
      },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const { nodes, edges } = getCanvas(workflow);
    const findings = validateWorkflow(nodes, edges);
    const artifacts = await listScopingArtifacts({ workflowId: id });
    const editUrl = `${request.nextUrl.origin}/admin/workflows/${id}`;
    const summary = generateCustomerSummaryText({
      workflow,
      nodes,
      edges,
      findings,
      artifacts,
      editUrl,
    });
    const artifact = await createScopingArtifact(id, {
      kind: "customer_summary",
      title: "Customer handoff summary",
      detail: summary,
      status: "confirmed",
      severity: "info",
      source: "manual",
      metadata: { generatedVia: "editor" },
    });

    return NextResponse.json({
      summary,
      artifactId: artifact.id,
      editUrl,
      validation: {
        findings,
        counts: findings.reduce<Record<string, number>>((acc, finding) => {
          acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    console.error("POST /api/workflows/[id]/summary error:", err);
    return NextResponse.json(
      { error: "Failed to generate customer summary" },
      { status: 500 }
    );
  }
}
