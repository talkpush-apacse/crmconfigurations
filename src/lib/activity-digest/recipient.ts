import { normaliseRole } from "../roles";

/**
 * Who may receive the daily digest? Only a login that is a super admin (a Talkpush Admin marked as one). The address
 * itself comes from the ACTIVITY_DIGEST_TO setting, never from a request, and is checked against the login list every
 * time so removing someone's super admin mark stops their digest straight away.
 */
export function canReceiveDigest(user: { role: string; isSuperAdmin: boolean } | null | undefined): boolean {
  return Boolean(user && user.isSuperAdmin === true && normaliseRole(user.role) === "editor");
}
