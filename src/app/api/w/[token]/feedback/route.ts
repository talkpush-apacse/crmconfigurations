import { NextRequest } from "next/server";
import { limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { feedbackSchema, submitFeedback } from "@/lib/workflow/access/feedback-service";

type Ctx = { params: Promise<{ token: string }> };

/** Approve or request changes, tied to the exact version the person was looking at. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(
    request,
    token,
    async ({ access, who }) => submitFeedback(access.workflowId, who, feedbackSchema.parse(await readJson(request))),
    { limit: limiters.writes }
  );
}
