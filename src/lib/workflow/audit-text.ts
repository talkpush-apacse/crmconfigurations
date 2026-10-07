/**
 * How a workflow's activity log entry reads in the Review panel's Activity tab: "<who> <this text>".
 * Pure, so it is tested (tests/workflow-audit-text.test.ts). Unknown actions fall back to their raw name.
 */

export const ACTION_TEXT: Record<string, string> = {
  "link.created": "created a share link",
  "link.rotated": "replaced a share link",
  "link.disabled": "turned off a share link",
  "link.updated": "changed a share link",
  "link.opened": "opened the workflow",
  "member.invited": "invited someone",
  "member.updated": "changed someone's access",
  "member.revoked": "removed someone's access",
  "member.link_replaced": "replaced someone's link",
  "guest.identified": "gave a name",
  "access.settings_changed": "changed general access",
  "access.requested": "asked for access",
  "version.published": "published a version",
  "version.unpublished": "switched clients to the live version",
  "comment.created": "commented",
  "comment.replied": "replied to a comment",
  "comment.resolved": "resolved a comment",
  "comment.reopened": "reopened a comment",
  "suggestion.created": "suggested changes",
  "suggestion.accepted": "accepted a suggestion",
  "suggestion.rejected": "rejected a suggestion",
  "suggestion.withdrawn": "withdrew a suggestion",
  "suggestion.stale": "had a suggestion that no longer fits",
  "review.approved": "approved",
  "review.changes_requested": "asked for changes",
  "canvas.edited": "edited the diagram",
};

const nameOf = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function describeAuditAction(action: string, detail?: Record<string, unknown> | null): string {
  if (action === "account.linked" || action === "account.unlinked") {
    const to = nameOf(detail?.accountName);
    const from = nameOf(detail?.previousAccountName);
    if (action === "account.unlinked") return from ? `took this workflow out of ${from}` : "took this workflow out of its company";
    if (to && from) return `moved this workflow from ${from} to ${to}`;
    return to ? `filed this workflow under ${to}` : "filed this workflow under a company";
  }
  return ACTION_TEXT[action] ?? action;
}
