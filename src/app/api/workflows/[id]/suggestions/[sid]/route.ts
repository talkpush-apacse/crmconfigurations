import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withStaff } from "@/lib/workflow/access/route-helpers";
import { acceptSuggestion, rejectSuggestion, withdrawSuggestion } from "@/lib/workflow/access/suggestions-service";

type Ctx = { params: Promise<{ id: string; sid: string }> };
const schema = z.object({ action: z.enum(["accept", "reject", "withdraw"]) });

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, sid } = await params;
  return withStaff(request, async ({ who }) => {
    const { action } = schema.parse(await readJson(request));
    if (action === "accept") return acceptSuggestion(id, sid, who);
    if (action === "reject") return rejectSuggestion(id, sid, who);
    return withdrawSuggestion(id, sid, who);
  });
}
