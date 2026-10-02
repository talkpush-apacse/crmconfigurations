import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createMetric, listMetrics, listProjectReadings } from "@/lib/tracker/metric-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => ({ metrics: await listMetrics(id), readings: await listProjectReadings(id) }));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => createMetric(id, await readJson(request), actor), 201);
}
