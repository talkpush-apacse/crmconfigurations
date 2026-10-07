import { NextRequest, NextResponse } from "next/server";
import { sweepAndDispatch } from "@/lib/notification-sweep";
import { rejectUnlessCron } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const denied = rejectUnlessCron(request);
  if (denied) return denied;

  const result = await sweepAndDispatch();
  return NextResponse.json(result);
}
