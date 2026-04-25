import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  createSnapshot,
  listSnapshots,
  SnapshotServiceError,
} from "@/lib/snapshot-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";

    const snapshots = await listSnapshots(id, { includeArchived });
    return NextResponse.json({ snapshots });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/checklists/[id]/snapshots error:", err);
    return NextResponse.json({ error: "Failed to list snapshots" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { label, description } = body as {
      label?: string;
      description?: string;
    };

    const snapshot = await createSnapshot(id, {
      label: label ?? null,
      description: description ?? null,
      createdBy: "admin",
      createdByLabel: "Admin",
    });
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (err) {
    if (err instanceof SnapshotServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/checklists/[id]/snapshots error:", err);
    return NextResponse.json({ error: "Failed to create snapshot" }, { status: 500 });
  }
}
