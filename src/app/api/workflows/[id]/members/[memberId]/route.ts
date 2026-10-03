import { NextRequest } from "next/server";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { getAccessOverview, memberUpdateSchema, revokeMember, rotateMember, updateMember } from "@/lib/workflow/access/links-service";

type Ctx = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, memberId } = await params;
  return withStaff(request, async ({ admin }) => {
    await updateMember(id, admin.id, memberId, memberUpdateSchema.parse(await readJson(request)));
    return getAccessOverview(id);
  });
}

/** Removes the person's access; their address stops working on their next request. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, memberId } = await params;
  return withStaff(request, async ({ admin }) => {
    await revokeMember(id, admin.id, memberId);
    return getAccessOverview(id);
  });
}

/** "Get a new link" for this person (the old address dies). The new secret address is in the answer ONCE. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, memberId } = await params;
  return withStaff(request, async ({ admin }) => {
    const rotated = await rotateMember(id, admin.id, memberId);
    return { ...rotated, url: `${request.nextUrl.origin}/w/${rotated.token}` };
  });
}
