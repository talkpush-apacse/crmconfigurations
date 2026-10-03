import { NextRequest } from "next/server";
import { limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { createSuggestion, listSuggestions, suggestionCreateSchema } from "@/lib/workflow/access/suggestions-service";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(request, token, async ({ access, who }) => ({ items: who.principal.level === "viewer" ? [] : await listSuggestions(access.workflowId, who) }));
}

/** A suggest-only editor proposes a change. Nothing on the live diagram changes until staff accept it. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => createSuggestion(access.workflowId, who, suggestionCreateSchema.parse(await readJson(request))),
    { limit: limiters.writes }
  );
}
