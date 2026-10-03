import { NextRequest } from "next/server";
import { withStaff } from "@/lib/workflow/access/route-helpers";
import { buildClientPagePayload } from "@/lib/workflow/access/client-payload";
import { badRequest, notFound } from "@/lib/workflow/access/errors";
import type { ActingAs } from "@/lib/workflow/access/actor";
import type { Principal } from "@/lib/workflow/access/permissions";

type Ctx = { params: Promise<{ id: string; mode: string }> };

const MODES: Record<string, Pick<Principal, "level" | "editMode" | "canComment" | "canApprove">> = {
  viewer: { level: "viewer", editMode: "direct", canComment: false, canApprove: false },
  commenter: { level: "commenter", editMode: "direct", canComment: true, canApprove: false },
  "editor-direct": { level: "editor", editMode: "direct", canComment: true, canApprove: true },
  "editor-suggesting": { level: "editor", editMode: "suggest_only", canComment: true, canApprove: true },
};

/**
 * "Preview as...": the REAL client page data for a made-up visitor, so staff can check what each kind of client
 * sees (the best defence against leaking staff-only content). Read only: nothing is saved from a preview.
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id, mode } = await params;
  return withStaff(request, async () => {
    const base = MODES[mode];
    if (!base) throw badRequest("Unknown preview mode.");
    const who: ActingAs = {
      principal: { kind: "link", ...base, canAcceptSuggestions: false },
      identity: { displayName: "Preview visitor", verified: false },
    };
    const payload = await buildClientPagePayload(id, who, { needsName: false });
    if (!payload) throw notFound("Workflow");
    return payload;
  });
}
