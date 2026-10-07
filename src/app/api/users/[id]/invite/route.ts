/** Re-send the invitation email to a login that has not signed in yet. Editors only. */

import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { signInOrigin } from "@/lib/google-sign-in";
import { findPendingInvitee } from "@/lib/users-service";
import { usersErrorResponse } from "@/lib/users-http";
import { inviteByEmail } from "@/lib/user-invitation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireEditor(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const invitee = await findPendingInvitee(id);
    const invitation = await inviteByEmail({
      to: invitee.email,
      role: invitee.role,
      inviterEmail: auth.email,
      signInUrl: signInOrigin(process.env.GOOGLE_REDIRECT_URI?.trim(), request.nextUrl.origin),
    });
    return NextResponse.json({ invitation });
  } catch (err) {
    return usersErrorResponse(err);
  }
}
