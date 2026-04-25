import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  getSnapshot,
  restoreSnapshot,
  SnapshotServiceError,
} from "@/lib/snapshot-service";

export async function POST(
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

    const result = await restoreSnapshot(snapshotId, {
      createdBy: "admin",
      createdByLabel: "Admin",
    });

    return NextResponse.json({
      restored: true,
      preRestoreSnapshotId: result.preRestoreSnapshotId,
      newVersion: result.newVersion,
    });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST restore snapshot error:", err);
    return NextResponse.json({ error: "Failed to restore snapshot" }, { status: 500 });
  }
}
