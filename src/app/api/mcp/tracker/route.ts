/**
 * Project Tracker MCP endpoint (Streamable HTTP, stateless).
 * Separate from /api/mcp (checklists) with its own key: TRACKER_MCP_API_KEY.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { createTrackerMcpServer } from "@/lib/mcp/tracker";
import { validateTrackerMcpAuth } from "@/lib/mcp/tracker-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function json(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const auth = validateTrackerMcpAuth(request);
  if (!auth.valid) return json(401, { error: auth.error ?? "Unauthorized" });

  try {
    const server = createTrackerMcpServer();
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
    console.error("[tracker-mcp] error handling POST:", error instanceof Error ? error.message : error);
    return json(500, { error: "Internal server error" });
  }
}

export async function GET() {
  return json(405, { error: "Method not allowed. Use POST for MCP requests." });
}

export async function DELETE() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
