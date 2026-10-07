import { NextRequest, NextResponse } from "next/server";
import { scheduleNotificationSweep } from "@/lib/notification-sweep";
import { completeTabUpload } from "@/lib/tab-upload-service";
import { uploadErrorResponse } from "@/lib/upload-route-helpers";

export const dynamic = "force-dynamic";

/** Step 3 of a tab upload: confirm the file arrived within limits, then notify the checklist owner. */
export async function POST(request: NextRequest) {
  try {
    const result = await completeTabUpload(request, await request.json());
    const response = NextResponse.json(result);
    scheduleNotificationSweep(new URL(request.url).origin);
    return response;
  } catch (err) {
    return uploadErrorResponse(err, "POST /api/upload/complete");
  }
}
