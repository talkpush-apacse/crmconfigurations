/**
 * MCP Server API Route — Streamable HTTP Transport
 *
 * Handles MCP protocol over HTTP for Claude AI integration.
 * Auth: Bearer token via MCP_API_KEY environment variable.
 *
 * Stateless mode — each request creates a fresh transport/server pair.
 * Works on Vercel serverless without long-lived connections.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp-server";
import { validateMcpAuth } from "@/lib/mcp-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CORS headers for cross-origin MCP client access
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
  "Access-Control-Expose-Headers": "mcp-session-id",
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
  const auth = validateMcpAuth(request);
  if (!auth.valid) {
    return corsResponse(401, { error: auth.error! });
  }

  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
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

// --- GET (SSE stream — transport handles stateless 405 automatically) ---
export async function GET(request: Request) {
  const auth = validateMcpAuth(request);
  if (!auth.valid) {
    return corsResponse(401, { error: auth.error! });
  }

  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);

    if (response) {
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return corsResponse(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("[MCP] Error handling GET:", error);
    return corsResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

// --- DELETE (session cleanup — transport handles stateless mode) ---
export async function DELETE(request: Request) {
  const auth = validateMcpAuth(request);
  if (!auth.valid) {
    return corsResponse(401, { error: auth.error! });
  }

  try {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);

    if (response) {
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return corsResponse(200, { message: "OK" });
  } catch (error) {
    console.error("[MCP] Error handling DELETE:", error);
    return corsResponse(500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
