import type { Principal } from "./permissions";
import type { Identity } from "./resolve";
import type { AuditActorType } from "./audit";

/** Who is acting, in the shape the audit trail and comment/suggestion rows need. Staff pass their own label. */
export interface ActingAs {
  principal: Principal;
  identity: Identity;
  /** Staff only: the AdminUser id and a readable label (their email). */
  admin?: { id: string; label: string };
}

export function staffActing(admin: { id: string; label: string }, principal: Principal): ActingAs {
  return { principal, identity: { displayName: admin.label, verified: true }, admin };
}

export function actorOf(a: ActingAs): { actorType: AuditActorType; actorId: string | null; actorName: string | null } {
  if (a.admin) return { actorType: "admin", actorId: a.admin.id, actorName: a.admin.label };
  if (a.identity.memberId) return { actorType: "member", actorId: a.identity.memberId, actorName: a.identity.displayName };
  return { actorType: "guest", actorId: a.identity.guestId ?? null, actorName: a.identity.displayName };
}

/** The value stored in the "who wrote this" column: a member id, or "guest:<id>" for a shared-link visitor. */
export function authorKey(a: ActingAs): string | null {
  if (a.admin) return null;
  if (a.identity.memberId) return a.identity.memberId;
  return a.identity.guestId ? `guest:${a.identity.guestId}` : null;
}

export function displayNameOf(a: ActingAs): string {
  return a.identity.displayName?.trim() || (a.admin ? "Staff" : "Guest");
}
