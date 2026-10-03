import { protectedResourceMetadata } from "@/lib/mcp/oauth/metadata";
import { originOf } from "@/lib/mcp/oauth/origin";
import { oauthJson, oauthPreflight } from "@/lib/mcp/oauth/http";

export const dynamic = "force-dynamic";

/** The connectors that accept a sign-in. Anything else is not a protected resource of ours. */
const RESOURCES = new Set(["/api/mcp", "/api/mcp/tracker"]);

export function OPTIONS() {
  return oauthPreflight();
}

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  const resourcePath = `/${(path ?? []).join("/")}`;
  if (!RESOURCES.has(resourcePath)) return oauthJson({ error: "not_found" }, 404);
  return oauthJson(protectedResourceMetadata(originOf(request), resourcePath));
}
