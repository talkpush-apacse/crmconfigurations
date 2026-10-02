import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createAccount, listAccounts } from "@/lib/tracker/directory-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  return authed(request, async () => ({ accounts: await listAccounts(includeArchived) }));
}

export async function POST(request: NextRequest) {
  return authed(request, async () => createAccount(await readJson(request)), 201);
}
