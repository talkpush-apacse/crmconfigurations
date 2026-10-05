import { NextRequest } from "next/server";
import { createUploadTicket } from "@/lib/tracker/file-service";
import { authed, readJson } from "@/lib/tracker/route-helpers";

export const dynamic = "force-dynamic";

/** Staff only. Step 1 of an upload: check the file and return a one-off address to send its bytes to. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return authed(request, async () => createUploadTicket(id, await readJson(request)));
}
