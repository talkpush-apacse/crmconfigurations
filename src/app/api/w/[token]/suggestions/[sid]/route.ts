import { NextRequest } from "next/server";
import { z } from "zod";
import { limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { acceptSuggestion, rejectSuggestion, withdrawSuggestion } from "@/lib/workflow/access/suggestions-service";

type Ctx = { params: Promise<{ token: string; sid: string }> };
const schema = z.object({ action: z.enum(["withdraw", "accept", "reject"]) });

/** Withdraw your own suggestion, or (only if staff allowed it for you) accept or reject someone else's. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token, sid } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => {
      const { action } = schema.parse(await readJson(request));
      if (action === "withdraw") return withdrawSuggestion(access.workflowId, sid, who);
      if (action === "accept") return acceptSuggestion(access.workflowId, sid, who);
      return rejectSuggestion(access.workflowId, sid, who);
    },
    { limit: limiters.writes }
  );
}
