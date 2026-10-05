import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ScopingInputError,
  createScopingArtifact,
  isScopingArtifactKind,
  isScopingArtifactStatus,
  listScopingArtifacts,
} from "@/lib/workflow/scoping";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const workflow = await prisma.workflowProject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const kindParam = searchParams.get("kind");
    const statusParam = searchParams.get("status");
    const kind = isScopingArtifactKind(kindParam) ? kindParam : undefined;
    const status = isScopingArtifactStatus(statusParam) ? statusParam : undefined;

    const items = await listScopingArtifacts({
      workflowId: id,
      kind,
      status,
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/workflows/[id]/scoping-artifacts error:", err);
    return NextResponse.json(
      { error: "Failed to fetch scoping artifacts" },
      { status: 500 }
    );
  }
}

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
      select: { id: true },
    });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const artifact = await createScopingArtifact(id, body, { source: "manual" });
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (err) {
    if (err instanceof ScopingInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/workflows/[id]/scoping-artifacts error:", err);
    return NextResponse.json(
      { error: "Failed to create scoping artifact" },
      { status: 500 }
    );
  }
}
