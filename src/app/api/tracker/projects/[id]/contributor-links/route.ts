import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { originOf } from "@/lib/mcp/oauth/origin";
import { clientLinkBase, clientPageUrl } from "@/lib/tracker/client-link-url";
import { createContributorLink } from "@/lib/tracker/contributor-service";

export const dynamic = "force-dynamic";

/** Staff: create a contributor link for one client contact. The token is returned once. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(
    request,
    async (actor) => {
      const body = await readJson(request);
      const base = clientLinkBase(originOf(request));
      const link = await createContributorLink(id, body, actor);
      return { ...link, url: clientPageUrl(base, "contribute", link.token) };
    },
    201
  );
}
