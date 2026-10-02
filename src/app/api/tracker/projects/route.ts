import { NextRequest } from "next/server";
import { authed, readJson } from "@/lib/tracker/route-helpers";
import { createProject, listPortfolio } from "@/lib/tracker/project-service";
import { todayDateOnly } from "@/lib/tracker/dates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  return authed(request, async () => ({
    today: todayDateOnly(),
    projects: await listPortfolio({
      includeArchived: params.get("includeArchived") === "true",
      accountId: params.get("accountId") ?? undefined,
    }),
  }));
}

export async function POST(request: NextRequest) {
  return authed(request, async (actor) => createProject(await readJson(request), actor), 201);
}
