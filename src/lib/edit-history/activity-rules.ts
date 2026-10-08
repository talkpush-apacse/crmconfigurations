import type { EditActorType } from "./types";

/** The naming and "is this me?" rules for the others-editing banner. No server imports, so they can be tested alone. */

export type ActivityAudience = "client" | "staff";

/** Who is asking, so their own changes are left out. */
export interface ActivityMe {
  /** A named link. */
  linkId?: string | null;
  actorType: EditActorType;
  /** For a staff member: their name (email), which is how their changes are recorded. */
  name?: string;
}

/**
 * The name shown for a change. Staff and Claude are "Talkpush team" to a client (never an email address); staff see
 * the full name. People on the shared links cannot be told apart, so they are described, not named.
 */
export function displayNameFor(actorType: string, actorName: string, audience: ActivityAudience): string {
  switch (actorType) {
    case "link":
      return actorName;
    case "admin":
      return audience === "staff" ? actorName : "Talkpush team";
    case "mcp":
      return audience === "staff" ? actorName : "Talkpush team";
    case "legacy_link":
      return "Someone using the shared link";
    case "slug":
      return "Someone using the client form link";
    default:
      return audience === "staff" ? actorName : "Talkpush team";
  }
}

export function isMe(e: { actorType: string; actorName: string; linkId: string | null }, me: ActivityMe): boolean {
  if (me.linkId) return e.linkId === me.linkId;
  if (me.actorType === "admin") return e.actorType === "admin" && e.actorName === me.name;
  return e.actorType === me.actorType;
}
