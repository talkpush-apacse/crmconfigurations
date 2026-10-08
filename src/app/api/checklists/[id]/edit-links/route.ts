import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { createEditLink, listEditLinks } from "@/lib/edit-history/links-service";
import { NO_STORE, editLinkError } from "@/lib/edit-history/http";

/**
 * Staff only (Talkpush Admins; a read-only login must not see the secret link text).
 * GET  — the named edit links for this checklist, newest first, including turned-off ones.
 * POST — { name, expiresAt? } creates a named link for one person.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    return NextResponse.json({ links: await listEditLinks(id) }, { headers: NO_STORE });
  } catch (err) {
    return editLinkError(err, "GET /api/checklists/[id]/edit-links error:");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireEditor(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; expiresAt?: unknown };
    let expiresAt: Date | null = null;
    if (typeof body.expiresAt === "string" && body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "The end date must be a date in the future." }, { status: 400, headers: NO_STORE });
      }
    }
    const link = await createEditLink({ checklistId: id, name: body.name, createdByLabel: auth.email, expiresAt });
    return NextResponse.json({ link }, { status: 201, headers: NO_STORE });
  } catch (err) {
    return editLinkError(err, "POST /api/checklists/[id]/edit-links error:");
  }
}
