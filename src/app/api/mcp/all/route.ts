/**
 * Combined MCP endpoint (Streamable HTTP, stateless): checklist, tracker and workflow tools behind one URL.
 * The single-area endpoints (/api/mcp, /api/mcp/tracker, /api/mcp/workflows) still exist. Callers sign in through
 * Claude (OAuth), or use the optional key COMBINED_MCP_API_KEY (Bearer header only; never in the address).
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { COMBINED_RESOURCE_PATH, createCombinedMcpServer } from "@/lib/mcp/combined";
import { validateCombinedMcpAuth } from "@/lib/mcp/combined-auth";
import { actorLabelFor, authenticateMcpRequest, unauthorizedResponse } from "@/lib/mcp/oauth/request-auth";
import { originOf } from "@/lib/mcp/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
};

const RESOURCE_PATH = COMBINED_RESOURCE_PATH;

function json(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const auth = await authenticateMcpRequest(request, validateCombinedMcpAuth);
  if (!auth.ok) return unauthorizedResponse(request, RESOURCE_PATH, auth.error, CORS_HEADERS);

  try {
    const server = createCombinedMcpServer(originOf(request), { actor: { label: actorLabelFor(auth.caller), via: "mcp" } });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    if (response) {
      for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
      return response;
    }
    return json(500, { error: "No response from MCP transport" });
  } catch (error) {
    console.error("[combined-mcp] error handling POST:", error instanceof Error ? error.message : error);
    return json(500, { error: "Internal server error" });
  }
}

export async function GET() {
  return json(405, { error: "Method not allowed. Use POST for MCP requests." });
}

export async function DELETE() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
