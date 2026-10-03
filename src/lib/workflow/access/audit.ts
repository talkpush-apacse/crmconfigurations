import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type AuditActorType = "admin" | "member" | "guest" | "mcp" | "system";

export interface AuditInput {
  workflowId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}

/**
 * Writes one line to the workflow's audit trail ("who did what"). A failure to write the line must never
 * block the action itself, so errors are logged and swallowed. Never put a secret link in `detail`.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.workflowAuditEvent.create({
      data: {
        workflowId: input.workflowId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        detail: (input.detail ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[workflow-audit] could not record", input.action, err instanceof Error ? err.message : err);
  }
}
