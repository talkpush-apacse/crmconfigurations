import type { Via } from "../tracker/constants";

/**
 * Which comments are worth an instant email. Only comments from outside the Talkpush team: a client on a shared link,
 * or Claude. Staff comments are skipped (they would mostly be the team's own noise) and so are internal notes.
 */

/** A workflow comment alerts when it was NOT written by a signed-in Talkpush staff member. */
export function shouldAlertWorkflowComment(who: { admin?: unknown }): boolean {
  return !who.admin;
}

/** A tracker comment alerts when it is shared with the client and did not come from the staff website. */
export function shouldAlertTrackerRemark(input: { via: Via; visibility: string }): boolean {
  return input.visibility === "shared" && input.via !== "web";
}

/** The name to show: a client contact's label is "client:Name", and Claude's own label is not a person. */
export function trackerAuthorName(label: string, via: Via): string {
  if (via === "mcp") return "Claude";
  return label.replace(/^client:/i, "").trim() || "A client contact";
}
