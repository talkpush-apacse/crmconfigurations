import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { originOf } from "@/lib/mcp/oauth/origin";
import { clientLinkBase, clientViewUrl } from "@/lib/tracker/client-link-url";
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
  return authed(
    request,
    async (actor) => {
      const body = await readJson(request);
      const base = clientLinkBase(originOf(request)); // before creating anything, so a bad setting leaves no stray link
      const link = await createViewerLink(id, body, actor);
      return { ...link, url: clientViewUrl(base, link.token) };
    },
    201
  );
}
