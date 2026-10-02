import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { getAccount, updateAccount } from "@/lib/tracker/directory-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => getAccount(id));
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return authed(request, async () => updateAccount(id, await readJson(request)));
}
