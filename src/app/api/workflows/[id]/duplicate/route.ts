import { NextRequest } from "next/server";
import { z } from "zod";
import { withStaff } from "@/lib/workflow/access/route-helpers";
import { AccessError } from "@/lib/workflow/access/errors";
import { duplicateWorkflowProject } from "@/lib/workflow/duplicate";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ workflowName: z.string().trim().min(1).max(200).optional() });

/** Copy a workflow (every page and its look) into a new private draft. The body is optional: { workflowName? }. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withStaff(
    request,
    async () => {
      const body = schema.parse(await request.json().catch(() => ({})));
      const copy = await duplicateWorkflowProject(id, body);
      if (!copy) throw new AccessError("Workflow not found.", 404, "not_found");
      return { id: copy.id, pageCount: copy.pageCount };
    },
    201
  );
}
