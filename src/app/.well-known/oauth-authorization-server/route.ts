import { authorizationServerMetadata } from "@/lib/mcp/oauth/metadata";
import { originOf } from "@/lib/mcp/oauth/origin";
import { oauthJson, oauthPreflight } from "@/lib/mcp/oauth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthPreflight();
}

export function GET(request: Request) {
  return oauthJson(authorizationServerMetadata(originOf(request)));
}
