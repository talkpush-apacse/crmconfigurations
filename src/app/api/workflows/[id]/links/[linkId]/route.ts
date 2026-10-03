import { NextRequest } from "next/server";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { disableLink, getAccessOverview, linkUpdateSchema, updateLink } from "@/lib/workflow/access/links-service";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, linkId } = await params;
  return withStaff(request, async ({ admin }) => {
    await updateLink(id, admin.id, linkId, linkUpdateSchema.parse(await readJson(request)));
    return getAccessOverview(id);
  });
}

/** Turns the link off; the address stops working at once. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, linkId } = await params;
  return withStaff(request, async ({ admin }) => {
    await disableLink(id, admin.id, linkId);
    return getAccessOverview(id);
  });
}
