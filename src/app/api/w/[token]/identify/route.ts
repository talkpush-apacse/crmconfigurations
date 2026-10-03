import { NextRequest } from "next/server";
import { z } from "zod";
import { json, limiters, readJson, withToken } from "@/lib/workflow/access/route-helpers";
import { badRequest } from "@/lib/workflow/access/errors";
import { GUEST_COOKIE, encodeGuestCookie, newGuest } from "@/lib/workflow/access/guest";
import { recordAudit } from "@/lib/workflow/access/audit";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(120).optional().or(z.literal("")) });

/** A shared-link visitor says who they are, once. The name is self-declared, so it always shows as unverified. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withToken(
    request,
    token,
    async ({ access }) => {
      if (access.source.type === "member") throw badRequest("You were invited by name already.");
      const input = schema.parse(await readJson(request));
      const guest = newGuest(input.name, input.email || undefined);
      await recordAudit({ workflowId: access.workflowId, actorType: "guest", actorId: guest.id, actorName: guest.name, action: "guest.identified" });
      const res = json({ ok: true, displayName: guest.name });
      res.cookies.set(GUEST_COOKIE, encodeGuestCookie(guest), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      });
      return res;
    },
    { limit: limiters.sensitive }
  );
}
