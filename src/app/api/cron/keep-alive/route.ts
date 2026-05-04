import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
}
