import { NextRequest } from "next/server";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { createMember, memberCreateSchema } from "@/lib/workflow/access/links-service";

type Ctx = { params: Promise<{ id: string }> };

/** Invites one named person. Their personal secret address is in the answer ONCE; copy it now. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(
    request,
    async ({ admin }) => {
      const created = await createMember(id, admin.id, memberCreateSchema.parse(await readJson(request)));
      return { ...created, url: `${request.nextUrl.origin}/w/${created.token}` };
    },
    201
  );
}
