import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  getSnapshot,
  hardDeleteSnapshot,
  softDeleteSnapshot,
  SnapshotServiceError,
  updateSnapshot,
} from "@/lib/snapshot-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id, snapshotId } = await params;
    const result = await getSnapshot(snapshotId);

    if (result.checklistId !== id) {
      return NextResponse.json({ error: "Snapshot does not belong to this checklist" }, { status: 404 });
    }

    return NextResponse.json({ metadata: result.metadata, payload: result.payload });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET snapshot error:", err);
    return NextResponse.json({ error: "Failed to load snapshot" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id, snapshotId } = await params;
    const existing = await getSnapshot(snapshotId);
    if (existing.checklistId !== id) {
      return NextResponse.json({ error: "Snapshot does not belong to this checklist" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { label, description, archived } = body as {
      label?: string | null;
      description?: string | null;
      archived?: boolean;
    };

    const updated = await updateSnapshot(snapshotId, { label, description, archived });
    return NextResponse.json({ snapshot: updated });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH snapshot error:", err);
    return NextResponse.json({ error: "Failed to update snapshot" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id, snapshotId } = await params;
    const existing = await getSnapshot(snapshotId);
    if (existing.checklistId !== id) {
      return NextResponse.json({ error: "Snapshot does not belong to this checklist" }, { status: 404 });
    }

    const mode = request.nextUrl.searchParams.get("mode");
    if (mode === "hard") {
      await hardDeleteSnapshot(snapshotId);
      return NextResponse.json({ success: true, mode: "hard" });
    }

    await softDeleteSnapshot(snapshotId);
    return NextResponse.json({ success: true, mode: "soft" });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE snapshot error:", err);
    return NextResponse.json({ error: "Failed to delete snapshot" }, { status: 500 });
  }
}
