import { NextRequest, NextResponse } from "next/server";
import { createTabUploadTicket } from "@/lib/tab-upload-service";
import { uploadErrorResponse } from "@/lib/upload-route-helpers";

export const dynamic = "force-dynamic";

/** Step 1 of a tab upload: check the file, return a one-off storage address for the browser to send it to. */
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await createTabUploadTicket(request, await request.json()));
  } catch (err) {
    return uploadErrorResponse(err, "POST /api/upload/ticket");
  }
}
