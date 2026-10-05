import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getCanvas } from "@/lib/workflow/helpers";
import { computeStepNumbers } from "@/lib/workflow/numbering";
import { validateWorkflow } from "@/lib/workflow/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const { nodes, edges } = getCanvas(workflow);
    const findings = validateWorkflow(nodes, edges, { diagramStyle: workflow.diagramStyle });
    const { stepNumbers, warnings } = computeStepNumbers(nodes, edges);

    return NextResponse.json({
      findings,
      counts: findings.reduce<Record<string, number>>((acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
        return acc;
      }, {}),
      stepNumbers: Object.fromEntries(stepNumbers),
      warnings: Array.from(warnings),
    });
  } catch (err) {
    console.error("POST /api/workflows/[id]/validate error:", err);
    return NextResponse.json(
      { error: "Failed to validate workflow" },
      { status: 500 }
    );
  }
}
