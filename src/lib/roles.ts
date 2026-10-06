/**
 * Roles for staff logins.
 *
 *   editor = can change things (every login was an editor before roles existed, so this is the default)
 *   viewer = read-only: can open and read everything, cannot change anything
 *
 * Plain strings in the database (like the tracker's statuses), validated here. No server imports, so screens can use it.
 */

export const ROLES = ["editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** What people see. The stored values stay "editor" and "viewer" so nothing that already checks them changes. */
export const ROLE_LABELS: Record<Role, string> = {
  editor: "Talkpush Admin",
  viewer: "Talkpush read-only",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  editor: "Can view and change everything, add and remove other users, and archive projects.",
  viewer: "Can view everything and download exports. Cannot change anything.",
};

/** A Talkpush Admin who can also add and remove super admins. Stored as a separate yes/no on the login, not as a role. */
export const SUPER_ADMIN_LABEL = "Super admin";
export const SUPER_ADMIN_DESCRIPTION = "A Talkpush Admin who can also add and remove super admins. Only a super admin can change another super admin.";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Anything that is not clearly "editor" is treated as read-only, so a bad value can never grant more access. */
export function normaliseRole(value: unknown): Role {
  return value === "editor" ? "editor" : "viewer";
}

export const READ_ONLY_MESSAGE = "Your login is read-only, so you cannot change this. Ask a Talkpush Admin to do it.";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * POST routes that only read (they use POST because they take a body). Everything else that is not a plain read is
 * refused for a read-only login. Keep this list short: a route that is not listed is blocked, which is the safe default.
 */
const READ_ONLY_POST_ROUTES: RegExp[] = [/^\/api\/workflows\/[^/]+\/validate\/?$/];

/** May a login with this role make this call? Editors may do anything; read-only logins may only read. */
export function roleMayCall(role: Role, method: string, pathname: string): boolean {
  if (role === "editor") return true;
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  return method.toUpperCase() === "POST" && READ_ONLY_POST_ROUTES.some((re) => re.test(pathname));
}
