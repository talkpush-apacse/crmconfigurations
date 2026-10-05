/** Switch one connection off. Takes effect on the very next call: the token is refused and cannot be renewed. */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { revokeConnection } from "@/lib/mcp/oauth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  try {
    const revoked = await revokeConnection(id);
    if (!revoked) return NextResponse.json({ error: "That connection was not found or is already revoked." }, { status: 404 });
    console.info(`[mcp-connections] connection ${id} revoked by admin ${auth.userId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mcp-connections] revoke error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
