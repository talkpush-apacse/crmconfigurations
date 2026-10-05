/** Staff logins: list and add. Editors only (even to look), because it shows who has access. */

import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/api-auth";
import { signInOrigin } from "@/lib/google-sign-in";
import { createUser, listUsers } from "@/lib/users-service";
import { usersErrorResponse } from "@/lib/users-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireEditor(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({
      users: await listUsers(auth.userId),
      // The address a new person should open to sign in with Google.
      signInUrl: signInOrigin(process.env.GOOGLE_REDIRECT_URI?.trim(), request.nextUrl.origin),
    });
  } catch (err) {
    return usersErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireEditor(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => null);
    return NextResponse.json(await createUser(body, auth.userId), { status: 201 });
  } catch (err) {
    return usersErrorResponse(err);
  }
}
