import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { getAccessOverview, updateGeneralSettings } from "@/lib/workflow/access/links-service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ generalAccess: z.enum(["restricted", "anyone_with_link"]).optional(), showFeasibility: z.boolean().optional() });

/** Who has access: the shared links, the named invites, and the general settings. Secret links are never included. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async () => getAccessOverview(id));
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(request, async ({ admin }) => {
    await updateGeneralSettings(id, admin.id, schema.parse(await readJson(request)));
    return getAccessOverview(id);
  });
}
