import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UploadError } from "@/lib/tab-upload-service";

/** Turns the upload service's errors into the { error } JSON the browser code expects. */
export function uploadErrorResponse(err: unknown, label: string): NextResponse {
  if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof z.ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  console.error(`${label} error:`, err);
  return NextResponse.json({ error: "Upload failed" }, { status: 500 });
}
