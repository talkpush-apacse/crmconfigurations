import type { Role } from "./roles";

/**
 * Safety rules for managing logins. Pure, so they are easy to test and the screen can reuse the wording.
 * The aim: nobody can lock the team out, nobody can quietly change their own access, and only a super admin
 * can touch another super admin.
 */

export interface UserLike {
  id: string;
  role: Role;
  /** A Talkpush Admin who can also manage super admins. Missing means no. */
  isSuperAdmin?: boolean;
}

export type RuleResult = { ok: true } | { ok: false; error: string };

const editors = (users: readonly UserLike[]) => users.filter((u) => u.role === "editor");
const superAdmins = (users: readonly UserLike[]) => users.filter((u) => u.isSuperAdmin === true);
const isSuper = (users: readonly UserLike[], id: string) => users.find((u) => u.id === id)?.isSuperAdmin === true;

export function checkRoleChange(users: readonly UserLike[], targetId: string, newRole: Role, actorId: string): RuleResult {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "That login was not found." };
  if (targetId === actorId) return { ok: false, error: "You cannot change your own role. Ask another Talkpush Admin." };
  if (target.isSuperAdmin && !isSuper(users, actorId)) return { ok: false, error: "Only a super admin can change a super admin." };
  if (target.role === newRole) return { ok: true };
  if (target.isSuperAdmin && newRole !== "editor") {
    return { ok: false, error: "A super admin has to be a Talkpush Admin. Remove their super admin status first." };
  }
  if (target.role === "editor" && newRole !== "editor" && editors(users).length <= 1) {
    return { ok: false, error: "There must always be at least one Talkpush Admin." };
  }
  return { ok: true };
}

export function checkRemoval(users: readonly UserLike[], targetId: string, actorId: string): RuleResult {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "That login was not found." };
  if (targetId === actorId) return { ok: false, error: "You cannot remove your own login. Ask another Talkpush Admin." };
  if (target.isSuperAdmin && !isSuper(users, actorId)) return { ok: false, error: "Only a super admin can remove a super admin." };
  if (target.isSuperAdmin && superAdmins(users).length <= 1) return { ok: false, error: "There must always be at least one super admin." };
  if (target.role === "editor" && editors(users).length <= 1) {
    return { ok: false, error: "There must always be at least one Talkpush Admin." };
  }
  return { ok: true };
}

/** Making someone a super admin, or taking it away. Only a super admin may do either. */
export function checkSuperAdminChange(users: readonly UserLike[], targetId: string, makeSuper: boolean, actorId: string): RuleResult {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "That login was not found." };
  if (!isSuper(users, actorId)) return { ok: false, error: "Only a super admin can add or remove a super admin." };
  if ((target.isSuperAdmin === true) === makeSuper) return { ok: true };
  if (makeSuper && target.role !== "editor") return { ok: false, error: "Make them a Talkpush Admin first. A super admin has to be a Talkpush Admin." };
  if (!makeSuper && superAdmins(users).length <= 1) return { ok: false, error: "There must always be at least one super admin." };
  return { ok: true };
}

/** Logins from outside Talkpush are allowed, but the list marks them so nobody is surprised. */
export function isTalkpushEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@talkpush.com");
}
