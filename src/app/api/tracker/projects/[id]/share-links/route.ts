import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createViewerLink, listShareLinks } from "@/lib/tracker/share-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => ({ links: await listShareLinks(id) }));
}

/** Staff only. The response contains the secret token exactly once. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => createViewerLink(id, await readJson(request), actor), 201);
}
