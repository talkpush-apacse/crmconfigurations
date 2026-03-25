import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, isAdmin: false });
  }

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    // Old tokens without role — treat as unauthenticated
    if (!payload.role) {
      return NextResponse.json({ authenticated: false, isAdmin: false });
    }

    return NextResponse.json({
      authenticated: true,
      role: payload.role,
      isAdmin: payload.role === "ADMIN",
    });
  } catch {
    return NextResponse.json({ authenticated: false, isAdmin: false });
  }
}
