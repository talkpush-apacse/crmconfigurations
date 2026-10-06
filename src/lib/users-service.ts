import { z } from "zod";
import { prisma } from "@/lib/db";
import { forgetUserAccess } from "@/lib/api-auth";
import { normaliseRole, ROLES } from "@/lib/roles";
import { checkRemoval, checkRoleChange, checkSuperAdminChange } from "@/lib/users-rules";

/** Managing staff logins. Talkpush Admins only (the routes enforce it); super admins have a few extra powers (see users-rules.ts). */

export class UserError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "UserError";
  }
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  role: z.enum(ROLES, { error: "Choose Talkpush Admin or Talkpush read-only." }).default("viewer"),
});
const roleSchema = z.object({ role: z.enum(ROLES, { error: "Choose Talkpush Admin or Talkpush read-only." }) }).strict();
const superSchema = z.object({ isSuperAdmin: z.boolean({ error: "Choose whether this person is a super admin." }) }).strict();

function serialize(u: { id: string; email: string; role: string; isSuperAdmin: boolean; googleId: string | null; passwordHash: string | null; createdAt: Date }, currentUserId: string) {
  return {
    id: u.id,
    email: u.email,
    role: normaliseRole(u.role),
    isSuperAdmin: u.isSuperAdmin === true && normaliseRole(u.role) === "editor",
    // Never send the hash itself, only whether there is a way to sign in.
    signIn: u.googleId ? "Google" : u.passwordHash ? "Password" : "Not signed in yet",
    createdAt: u.createdAt.toISOString(),
    isYou: u.id === currentUserId,
  };
}
export type UserDTO = ReturnType<typeof serialize>;

const SELECT = { id: true, email: true, role: true, isSuperAdmin: true, googleId: true, passwordHash: true, createdAt: true } as const;

export async function listUsers(currentUserId: string): Promise<UserDTO[]> {
  const users = await prisma.adminUser.findMany({ select: SELECT, orderBy: { createdAt: "asc" } });
  return users.map((u) => serialize(u, currentUserId));
}

/**
 * Adds a login by email. No password is set: the person signs in with Google, which only works for an email that is on
 * this list. (Logins with a password are created the older way, directly in the database.)
 */
export async function createUser(input: unknown, currentUserId: string): Promise<UserDTO> {
  const data = createSchema.parse(input);
  const existing = await prisma.adminUser.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } }, select: { id: true } });
  if (existing) throw new UserError("That email already has a login.");
  const created = await prisma.adminUser.create({ data: { email: data.email, role: data.role }, select: SELECT });
  console.info(`[users] login added: ${created.email} as ${created.role}`);
  return serialize(created, currentUserId);
}

export async function changeRole(targetId: string, input: unknown, actorId: string): Promise<UserDTO> {
  const { role } = roleSchema.parse(input);
  const all = await prisma.adminUser.findMany({ select: { id: true, role: true, isSuperAdmin: true } });
  const check = checkRoleChange(all.map((u) => ({ id: u.id, role: normaliseRole(u.role), isSuperAdmin: u.isSuperAdmin })), targetId, role, actorId);
  if (!check.ok) throw new UserError(check.error, check.error.includes("not found") ? 404 : check.error.startsWith("Only") ? 403 : 400);
  const updated = await prisma.adminUser.update({ where: { id: targetId }, data: { role }, select: SELECT });
  forgetUserAccess(targetId);
  console.info(`[users] role changed: ${updated.email} is now ${updated.role}`);
  return serialize(updated, actorId);
}

/** Makes a Talkpush Admin a super admin, or takes it away. Only a super admin may do this. */
export async function changeSuperAdmin(targetId: string, input: unknown, actorId: string): Promise<UserDTO> {
  const { isSuperAdmin } = superSchema.parse(input);
  const all = await prisma.adminUser.findMany({ select: { id: true, role: true, isSuperAdmin: true } });
  const check = checkSuperAdminChange(all.map((u) => ({ id: u.id, role: normaliseRole(u.role), isSuperAdmin: u.isSuperAdmin })), targetId, isSuperAdmin, actorId);
  if (!check.ok) throw new UserError(check.error, check.error.includes("not found") ? 404 : check.error.startsWith("Only") ? 403 : 400);
  const updated = await prisma.adminUser.update({ where: { id: targetId }, data: { isSuperAdmin }, select: SELECT });
  forgetUserAccess(targetId);
  console.info(`[users] super admin ${isSuperAdmin ? "granted to" : "removed from"} ${updated.email}`);
  return serialize(updated, actorId);
}

/** Removes a login and, with it, every Claude connection it made (those are deleted along with the login). */
export async function removeUser(targetId: string, actorId: string): Promise<void> {
  const all = await prisma.adminUser.findMany({ select: { id: true, role: true, isSuperAdmin: true } });
  const check = checkRemoval(all.map((u) => ({ id: u.id, role: normaliseRole(u.role), isSuperAdmin: u.isSuperAdmin })), targetId, actorId);
  if (!check.ok) throw new UserError(check.error, check.error.includes("not found") ? 404 : check.error.startsWith("Only") ? 403 : 400);
  const removed = await prisma.adminUser.delete({ where: { id: targetId }, select: { email: true } });
  forgetUserAccess(targetId);
  console.info(`[users] login removed: ${removed.email}`);
}
