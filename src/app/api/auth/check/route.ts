import { NextRequest, NextResponse } from "next/server";
import { lookupUser } from "@/lib/api-auth";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Is this browser signed in, and as whom? The screens use the role to hide buttons a read-only login cannot use. */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return NextResponse.json({ authenticated: false });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ authenticated: false });

  // A login that has been removed no longer counts as signed in.
  const user = await lookupUser(payload.userId);
  if (!user) return NextResponse.json({ authenticated: false });

  return NextResponse.json({ authenticated: true, email: user.email, role: user.role });
}
