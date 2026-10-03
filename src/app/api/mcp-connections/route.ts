/** The "Connected apps" list: who has connected Claude (or another app) to the connectors. Staff only. */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listConnections } from "@/lib/mcp/oauth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const connections = await listConnections();
    return NextResponse.json({
      connections: connections.map((c) => ({
        id: c.id,
        email: c.email,
        appName: c.appName,
        connectedAt: c.connectedAt.toISOString(),
        lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error("[mcp-connections] list error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
