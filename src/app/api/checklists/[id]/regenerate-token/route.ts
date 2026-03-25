import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { randomUUID } from "crypto";

/**
 * POST — Regenerate the editor token for a checklist.
 * Requires admin auth. Invalidates the old editor link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const checklist = await prisma.checklist.update({
      where: { id },
      data: { editorToken: randomUUID() },
      select: { id: true, editorToken: true },
    });

    return NextResponse.json(checklist);
  } catch (err) {
    console.error("POST /api/checklists/[id]/regenerate-token error:", err);
    return NextResponse.json({ error: "Failed to regenerate token" }, { status: 500 });
  }
}
