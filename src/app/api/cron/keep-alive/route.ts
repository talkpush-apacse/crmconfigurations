import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rejectUnlessCron } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const denied = rejectUnlessCron(request);
  if (denied) return denied;

  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, pinged_at: new Date().toISOString() });
}
