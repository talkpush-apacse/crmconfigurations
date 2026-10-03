/**
 * Who may do what. This is the single source of truth for the permission table in the spec (section 12.2).
 * Every route asks `can(principal, capability)`; deny by default. Hiding a button in the page is never the
 * protection, this is.
 */

export type AccessLevel = "admin" | "editor" | "commenter" | "viewer";
export type EditMode = "direct" | "suggest_only";

/** The person (or link) making a request, after their secret link has been checked. */
export interface Principal {
  kind: "admin" | "member" | "link";
  level: AccessLevel;
  /** Editors only: change the diagram directly, or only propose changes. */
  editMode: EditMode;
  /** Extra permission switches (named invites and links carry them). */
  canApprove: boolean;
  /** Viewers can comment only when staff turned this on. */
  canComment: boolean;
  /** Direct-mode editors can accept other people's suggestions only when staff turned this on. */
  canAcceptSuggestions: boolean;
}

export const ADMIN: Principal = {
  kind: "admin",
  level: "admin",
  editMode: "direct",
  canApprove: true,
  canComment: true,
  canAcceptSuggestions: true,
};

export type Capability =
  | "dashboard.view"
  | "workflow.create"
  | "workflow.delete"
  | "canvas.view"
  | "canvas.edit"
  | "canvas.suggest"
  | "internal.edit"
  | "suggestion.accept"
  | "suggestion.withdrawOwn"
  | "ai.generate"
  | "brief.view"
  | "comment.create"
  | "comment.resolveOwn"
  | "approve"
  | "versions.viewFull"
  | "versions.viewPublished"
  | "version.restore"
  | "status.change"
  | "publish"
  | "links.manage"
  | "export.internal"
  | "export.client"
  | "audit.view";

const ADMIN_ONLY: Capability[] = [
  "dashboard.view",
  "workflow.create",
  "workflow.delete",
  "internal.edit",
  "ai.generate",
  "brief.view",
  "versions.viewFull",
  "version.restore",
  "status.change",
  "publish",
  "links.manage",
  "export.internal",
  "audit.view",
];

export function can(principal: Principal | null | undefined, capability: Capability): boolean {
  if (!principal) return false;
  if (principal.level === "admin") return true;
  if (ADMIN_ONLY.includes(capability)) return false;

  switch (capability) {
    case "canvas.view":
    case "export.client":
      return true;
    case "canvas.edit":
      return principal.level === "editor" && principal.editMode === "direct";
    case "canvas.suggest":
      // Every editor can propose changes (Docs-style "Suggesting"); a suggest-only editor can do nothing else.
      return principal.level === "editor";
    case "suggestion.withdrawOwn":
      return principal.level === "editor";
    case "suggestion.accept":
      return principal.level === "editor" && principal.editMode === "direct" && principal.canAcceptSuggestions;
    case "comment.create":
    case "comment.resolveOwn":
      // Editors always; commenters and viewers only while their comment switch is on (viewers start with it off).
      return principal.level === "editor" || principal.canComment;
    case "approve":
      return principal.level === "editor" || principal.canApprove;
    case "versions.viewPublished":
      return principal.level === "editor";
    default:
      return false;
  }
}

/** Sensible defaults for a new invite or link at a given level (spec appendix F: viewers look only). */
export function defaultsForLevel(level: Exclude<AccessLevel, "admin">): Pick<Principal, "canComment" | "canApprove" | "canAcceptSuggestions" | "editMode"> {
  return {
    canComment: level !== "viewer",
    canApprove: false,
    canAcceptSuggestions: false,
    editMode: "direct",
  };
}

/** The shared link levels people see in the Share dialog map onto the same access levels. */
export function levelForLink(linkLevel: string): Exclude<AccessLevel, "admin"> | null {
  switch (linkLevel) {
    case "view":
      return "viewer";
    case "comment":
      return "commenter";
    case "edit":
      return "editor";
    default:
      return null;
  }
}

export function levelForMember(memberLevel: string): Exclude<AccessLevel, "admin"> | null {
  return memberLevel === "viewer" || memberLevel === "commenter" || memberLevel === "editor" ? memberLevel : null;
}

// ---- is this link usable right now? --------------------------------------------------------------

export type AccessProblem = "revoked" | "disabled" | "expired" | "restricted" | "passcode_required" | "wrong_passcode" | "unknown_level";

export function linkProblem(
  link: { level: string; disabledAt: Date | null; expiresAt: Date | null; passcodeHash: string | null },
  workflow: { generalAccess: string },
  passcodeOk: boolean | null,
  now: Date = new Date()
): AccessProblem | null {
  if (!levelForLink(link.level)) return "unknown_level";
  if (link.disabledAt) return "disabled";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";
  if (workflow.generalAccess !== "anyone_with_link") return "restricted";
  if (link.passcodeHash && passcodeOk === null) return "passcode_required";
  if (link.passcodeHash && passcodeOk === false) return "wrong_passcode";
  return null;
}

export function memberProblem(
  member: { level: string; revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date()
): AccessProblem | null {
  if (!levelForMember(member.level)) return "unknown_level";
  if (member.revokedAt) return "revoked";
  if (member.expiresAt && member.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}
