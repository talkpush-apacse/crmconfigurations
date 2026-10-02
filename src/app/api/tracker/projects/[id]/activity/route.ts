import { NextRequest } from "next/server";
import { authed } from "@/lib/tracker/route-helpers";
import { listActivity } from "@/lib/tracker/activity-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  return authed(request, async () =>
    listActivity(id, { limit: Number(q.get("limit")) || 50, before: q.get("before") ?? undefined })
  );
}
