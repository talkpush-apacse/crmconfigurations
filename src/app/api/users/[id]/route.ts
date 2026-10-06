/** Change one login's role or super admin status, or remove it. Talkpush Admins only; the rules for super admins are in users-rules.ts. */

import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { changeRole, changeSuperAdmin, removeUser } from "@/lib/users-service";
import { usersErrorResponse } from "@/lib/users-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireEditor(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const wantsSuperChange = body !== null && typeof body === "object" && "isSuperAdmin" in body;
    return NextResponse.json(wantsSuperChange ? await changeSuperAdmin(id, body, auth.userId) : await changeRole(id, body, auth.userId));
  } catch (err) {
    return usersErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireEditor(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await removeUser(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return usersErrorResponse(err);
  }
}
