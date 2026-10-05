import { NextRequest, NextResponse } from "next/server";
import { createDownloadUrl, removeProjectFile } from "@/lib/tracker/file-service";
import { authed } from "@/lib/tracker/route-helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Staff only. Sends the browser to a download link that stops working after a minute. Never cached. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => {
    const url = await createDownloadUrl(id);
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  });
}

/** Files are never hard-deleted: this hides one from the project. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => removeProjectFile(id, actor));
}
