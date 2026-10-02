import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createPerson, listPeople } from "@/lib/tracker/directory-service";

export const dynamic = "force-dynamic";

/** GET /api/tracker/people?accountId=...  Talkpush staff plus that account's contacts. Omit accountId for staff only. */
export async function GET(request: NextRequest) {
  const accountId = new URL(request.url).searchParams.get("accountId");
  return authed(request, async () => ({ people: await listPeople({ accountId }) }));
}

export async function POST(request: NextRequest) {
  return authed(request, async () => createPerson(await readJson(request)), 201);
}
