/**
 * Workflow Builder MCP endpoint (Streamable HTTP, stateless).
 * Separate from /api/mcp (checklists) and /api/mcp/tracker. Callers sign in through Claude (OAuth) or use the
 * key WORKFLOW_MCP_API_KEY (sent as a Bearer header; never in the address).
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { createWorkflowMcpServer } from "@/lib/mcp/workflows";
import { validateWorkflowMcpAuth } from "@/lib/mcp/workflow-auth";
import { actorLabelFor, authenticateMcpRequest, isReadOnlyCaller, unauthorizedResponse } from "@/lib/mcp/oauth/request-auth";
import { originOf } from "@/lib/mcp/oauth/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
};

const RESOURCE_PATH = "/api/mcp/workflows";

function json(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const auth = await authenticateMcpRequest(request, validateWorkflowMcpAuth);
  if (!auth.ok) return unauthorizedResponse(request, RESOURCE_PATH, auth.error, CORS_HEADERS);

  try {
    const server = createWorkflowMcpServer(originOf(request), { actor: { label: actorLabelFor(auth.caller), via: "mcp" }, readOnly: isReadOnlyCaller(auth.caller) });
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
    console.error("[workflow-mcp] error handling POST:", error instanceof Error ? error.message : error);
    return json(500, { error: "Internal server error" });
  }
}

export async function GET() {
  return json(405, { error: "Method not allowed. Use POST for MCP requests." });
}

export async function DELETE() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
