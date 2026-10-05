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

export const ROLE_LABELS: Record<Role, string> = {
  editor: "Editor",
  viewer: "Read-only",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  editor: "Can view and change everything.",
  viewer: "Can view everything. Cannot change anything.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Anything that is not clearly "editor" is treated as read-only, so a bad value can never grant more access. */
export function normaliseRole(value: unknown): Role {
  return value === "editor" ? "editor" : "viewer";
}

export const READ_ONLY_MESSAGE = "Your login is read-only, so you cannot change this. Ask an editor to do it.";

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
