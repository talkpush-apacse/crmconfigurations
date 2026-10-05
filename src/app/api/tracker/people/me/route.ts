import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ensureStaffPersonForUser } from "@/lib/tracker/directory-service";
import { errorResponse } from "@/lib/tracker/route-helpers";

export const dynamic = "force-dynamic";

/** "Add me": create (or return) the team member linked to the signed-in login. */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await ensureStaffPersonForUser(auth.userId), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
