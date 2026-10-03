import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { publishVersion, unpublish } from "@/lib/workflow/access/versions-service";
import { getAccessOverview } from "@/lib/workflow/access/links-service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ label: z.string().trim().max(80).optional() });

/** Takes a snapshot and makes it the version clients see by default. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ admin }) => {
    const body = request.headers.get("content-length") === "0" ? {} : await readJson(request).catch(() => ({}));
    const version = await publishVersion(id, admin, schema.parse(body).label);
    return { version, access: await getAccessOverview(id) };
  });
}

/** Clients see the live canvas again. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ admin }) => {
    await unpublish(id, admin);
    return getAccessOverview(id);
  });
}
