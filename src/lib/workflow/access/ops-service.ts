import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { applyOps, mirrorFirstPage, type OpPage, type WorkflowOp } from "@/lib/workflow/ops";
import { can, type Principal } from "./permissions";

/**
 * Saving a change safely: check the caller is allowed, apply the ops to the FULL canvas (including any
 * staff-only steps the caller never saw), and write only if nobody else saved in the meantime.
 */

export type SaveOpsResult =
  | { ok: true; revision: number; pages: OpPage[] }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "conflict"; latestRevision: number };

/**
 * Applies ops and writes them. `baseRevision` set = fail with "conflict" if the workflow moved on (a person editing).
 * `baseRevision` null = apply on top of whatever is current, retrying if another save lands in between (accepting a
 * suggestion). Throws OpError when an op is not allowed or no longer fits.
 */
export async function commitOps(params: {
  workflowId: string;
  baseRevision: number | null;
  ops: WorkflowOp[];
  principal: Principal;
}): Promise<SaveOpsResult> {
  const { workflowId, baseRevision, ops, principal } = params;
  for (let attempt = 0; attempt < 4; attempt++) {
    const workflow = await prisma.workflowProject.findUnique({
      where: { id: workflowId },
      select: { id: true, pages: true, revision: true, status: true },
    });
    if (!workflow) return { ok: false, reason: "not_found" };
    if (baseRevision !== null && workflow.revision !== baseRevision) {
      return { ok: false, reason: "conflict", latestRevision: workflow.revision };
    }

    const pages = applyOps((workflow.pages as unknown as OpPage[]) ?? [], ops, principal);
    const mirror = mirrorFirstPage(pages);

    // Compare-and-swap: only writes if the revision is still the one we read.
    const result = await prisma.workflowProject.updateMany({
      where: { id: workflowId, revision: workflow.revision },
      data: {
        pages: pages as unknown as Prisma.InputJsonValue,
        nodes: mirror.nodes as unknown as Prisma.InputJsonValue,
        edges: mirror.edges as unknown as Prisma.InputJsonValue,
        viewport: mirror.viewport as unknown as Prisma.InputJsonValue,
        revision: { increment: 1 },
        // Spec F5: an approval stops being true the moment the diagram changes.
        ...(workflow.status === "approved" ? { status: "modified_since_approval" } : {}),
      },
    });
    if (result.count === 1) return { ok: true, revision: workflow.revision + 1, pages };
    if (baseRevision !== null) {
      const latest = await prisma.workflowProject.findUnique({ where: { id: workflowId }, select: { revision: true } });
      return { ok: false, reason: "conflict", latestRevision: latest?.revision ?? workflow.revision + 1 };
    }
    // else: someone saved between our read and write; read again and re-apply.
  }
  return { ok: false, reason: "conflict", latestRevision: -1 };
}

/** A person's direct edit. */
export async function saveOps(params: {
  workflowId: string;
  baseRevision: number;
  ops: WorkflowOp[];
  principal: Principal;
}): Promise<SaveOpsResult> {
  if (!can(params.principal, "canvas.edit")) return { ok: false, reason: "forbidden" };
  return commitOps(params);
}
