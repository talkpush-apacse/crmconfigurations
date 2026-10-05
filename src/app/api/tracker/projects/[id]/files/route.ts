import { NextRequest } from "next/server";
import { listProjectFiles, registerProjectFile } from "@/lib/tracker/file-service";
import { authed, readJson } from "@/lib/tracker/route-helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Staff only. Lists the project's files (never the storage address). */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => ({ files: await listProjectFiles(id) }));
}

/** Staff only. Step 2 of an upload: record a file that has finished uploading to storage. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async (actor) => registerProjectFile(id, await readJson(request), actor), 201);
}
