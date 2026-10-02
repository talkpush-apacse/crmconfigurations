import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { addRemark, listRemarks } from "@/lib/tracker/item-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => ({ remarks: await listRemarks(id) }));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => addRemark(id, await readJson(request), actor), 201);
}
