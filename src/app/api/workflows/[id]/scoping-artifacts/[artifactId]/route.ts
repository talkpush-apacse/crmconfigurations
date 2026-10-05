import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  ScopingInputError,
  deleteScopingArtifact,
  updateScopingArtifact,
} from "@/lib/workflow/scoping";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, artifactId } = await params;
    const body = await request.json().catch(() => ({}));
    const artifact = await updateScopingArtifact({
      workflowId: id,
      artifactId,
      updates: body,
    });

    return NextResponse.json({ artifact });
  } catch (err) {
    if (err instanceof ScopingInputError) {
      const status = err.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error(
      "PATCH /api/workflows/[id]/scoping-artifacts/[artifactId] error:",
      err
    );
    return NextResponse.json(
      { error: "Failed to update scoping artifact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, artifactId } = await params;
    await deleteScopingArtifact({ workflowId: id, artifactId });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ScopingInputError) {
      const status = err.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error(
      "DELETE /api/workflows/[id]/scoping-artifacts/[artifactId] error:",
      err
    );
    return NextResponse.json(
      { error: "Failed to delete scoping artifact" },
      { status: 500 }
    );
  }
}
