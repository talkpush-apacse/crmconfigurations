import { WORKFLOW_STATUS_CONFIG, type WorkflowStatus } from "@/lib/workflow/types";

/**
 * How a workflow status looks on the staff screens. The label and class names come from the Sign tokens
 * (DESIGN.md status mapping): sage means approved, lavender means out for review, amber means waiting on
 * someone, sand means not started. The shared config in src/lib keeps its own classes for other callers.
 */
const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  shared: { label: "Shared", className: "bg-brand-lavender-lighter text-foreground" },
  approved: { label: "Approved", className: "bg-brand-sage text-foreground" },
  changes_requested: { label: "Changes requested", className: "bg-brand-amber/25 text-foreground" },
  modified_since_approval: { label: "Changed since approval", className: "bg-brand-amber/25 text-foreground" },
};

export function statusStyle(status: WorkflowStatus | string): { label: string; className: string } {
  return (
    STATUS_STYLE[status] ?? {
      label: WORKFLOW_STATUS_CONFIG[status as WorkflowStatus]?.label ?? String(status),
      className: "bg-muted text-muted-foreground",
    }
  );
}
