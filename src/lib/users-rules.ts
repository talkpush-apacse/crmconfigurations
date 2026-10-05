import type { Role } from "./roles";

/**
 * Safety rules for managing logins. Pure, so they are easy to test and the screen can reuse the wording.
 * The aim: nobody can lock the team out, and nobody can quietly change their own access.
 */

export interface UserLike {
  id: string;
  role: Role;
}

export type RuleResult = { ok: true } | { ok: false; error: string };

const editors = (users: readonly UserLike[]) => users.filter((u) => u.role === "editor");

export function checkRoleChange(users: readonly UserLike[], targetId: string, newRole: Role, actorId: string): RuleResult {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "That login was not found." };
  if (targetId === actorId) return { ok: false, error: "You cannot change your own role. Ask another editor." };
  if (target.role === newRole) return { ok: true };
  if (target.role === "editor" && newRole !== "editor" && editors(users).length <= 1) {
    return { ok: false, error: "There must always be at least one editor." };
  }
  return { ok: true };
}

export function checkRemoval(users: readonly UserLike[], targetId: string, actorId: string): RuleResult {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "That login was not found." };
  if (targetId === actorId) return { ok: false, error: "You cannot remove your own login. Ask another editor." };
  if (target.role === "editor" && editors(users).length <= 1) {
    return { ok: false, error: "There must always be at least one editor." };
  }
  return { ok: true };
}

/** Logins from outside Talkpush are allowed, but the list marks them so nobody is surprised. */
export function isTalkpushEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@talkpush.com");
}
