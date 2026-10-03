/**
 * MCP Server API Route — Streamable HTTP Transport
 *
 * Handles MCP protocol over HTTP for Claude AI integration.
 * Auth: a person signed in through Claude (OAuth), or the shared key MCP_API_KEY (Bearer header or ?api_key=).
 *
 * Stateless mode — each request creates a fresh transport/server pair.
 * Works on Vercel serverless without long-lived connections.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";
import { validateMcpAuth } from "@/lib/mcp-auth";
import { authenticateMcpRequest, unauthorizedResponse } from "@/lib/mcp/oauth/request-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CORS headers for cross-origin MCP client access
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version, WWW-Authenticate",
};

function corsResponse(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

// --- OPTIONS (CORS preflight) ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- POST (main MCP request handler) ---
export async function POST(request: Request) {
  const auth = await authenticateMcpRequest(request, validateMcpAuth);
  if (!auth.ok) {
    return unauthorizedResponse(request, "/api/mcp", auth.error, CORS_HEADERS);
  }

  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true, // return JSON instead of SSE for compatibility
    });

    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Add CORS headers to the transport response
    if (response) {
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return corsResponse(500, { error: "No response from MCP transport" });
  } catch (error) {
    console.error("[MCP] Error handling POST:", error);
    return corsResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

// --- GET (stateless mode — no SSE stream, return 405) ---
export async function GET() {
  return corsResponse(405, { error: "Method not allowed. Use POST for MCP requests." });
}

// --- DELETE (stateless mode — no sessions to clean up) ---
export async function DELETE() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
