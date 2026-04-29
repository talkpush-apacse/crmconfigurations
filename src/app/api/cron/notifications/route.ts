import { NextRequest, NextResponse } from "next/server";
import { sweepAndDispatch } from "@/lib/notification-sweep";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sweepAndDispatch();
  return NextResponse.json(result);
}
