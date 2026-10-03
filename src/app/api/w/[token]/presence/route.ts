import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { othersPresent, touchPresence } from "@/lib/workflow/access/presence";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({ editing: z.boolean().optional() });

/** "I am here" heartbeat (every ~15 seconds while the page is open). Returns who else is here. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(request, token, async ({ access, who }) => {
    const { editing } = schema.parse(await readJson(request));
    const key = who.identity.memberId ?? who.identity.guestId ?? access.source.id;
    if (who.identity.displayName) touchPresence(access.workflowId, key, who.identity.displayName, Boolean(editing));
    return { others: othersPresent(access.workflowId, key) };
  });
}
