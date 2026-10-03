import { prisma } from "@/lib/db";
import {
  linkProblem,
  levelForLink,
  levelForMember,
  memberProblem,
  type AccessProblem,
  type Principal,
} from "./permissions";
import { decodeGuestCookie, type GuestIdentity } from "./guest";
import { hashToken, passcodeMatches, tokenKindOf } from "./tokens";

/**
 * Turns a secret link from a web address into "who is this and what may they do".
 * Everything a route needs to know about the visitor comes from here.
 */

export interface Identity {
  /** Who to show next to comments and edits. */
  displayName: string | null;
  verified: boolean;
  memberId?: string;
  linkId?: string;
  guestId?: string;
  email?: string;
}

export interface ResolvedAccess {
  workflowId: string;
  principal: Principal;
  identity: Identity;
  source: { type: "link" | "member" | "legacy"; id: string };
  /** Legacy share links can pin one saved version; the page shows it instead of the published/live one. */
  pinnedVersionId?: string | null;
  /** Shared-link visitors must give a name once before they can comment or edit. */
  needsName: boolean;
}

export type ResolveResult =
  | { ok: true; access: ResolvedAccess }
  | { ok: false; problem: AccessProblem | "not_found"; workflowId?: string; clientName?: string };

export interface ResolveInput {
  token: string;
  passcode?: string | null;
  /** Value of the guest cookie, if the visitor has one. */
  guestCookie?: string | null;
}

export async function resolveAccess(input: ResolveInput): Promise<ResolveResult> {
  const kind = tokenKindOf(input.token);
  if (!kind) return resolveLegacy(input);
  const hash = hashToken(input.token);

  if (kind === "member") {
    const member = await prisma.workflowMember.findUnique({
      where: { tokenHash: hash },
      include: { workflow: { select: { id: true, clientName: true } } },
    });
    if (!member) return { ok: false, problem: "not_found" };
    const problem = memberProblem(member);
    if (problem) return { ok: false, problem, workflowId: member.workflowId, clientName: member.workflow.clientName };

    const level = levelForMember(member.level)!;
    const now = new Date();
    // Fire and forget: "last seen" is a nicety and must not slow or break the request.
    void prisma.workflowMember
      .update({ where: { id: member.id }, data: { lastSeenAt: now, ...(member.firstOpenedAt ? {} : { firstOpenedAt: now }) } })
      .catch(() => undefined);

    return {
      ok: true,
      access: {
        workflowId: member.workflowId,
        source: { type: "member", id: member.id },
        needsName: false,
        identity: { displayName: member.displayName, verified: member.emailVerified, memberId: member.id, email: member.email ?? undefined },
        principal: {
          kind: "member",
          level,
          editMode: member.editMode === "suggest_only" ? "suggest_only" : "direct",
          canApprove: member.canApprove,
          canComment: member.canComment,
          canAcceptSuggestions: member.canAcceptSuggestions,
        },
      },
    };
  }

  const link = await prisma.workflowLink.findUnique({
    where: { tokenHash: hash },
    include: { workflow: { select: { id: true, clientName: true, generalAccess: true } } },
  });
  if (!link) return { ok: false, problem: "not_found" };

  let passcodeOk: boolean | null = null;
  if (link.passcodeHash && input.passcode) passcodeOk = passcodeMatches(input.passcode, link.passcodeHash);
  const problem = linkProblem(link, link.workflow, passcodeOk);
  if (problem) return { ok: false, problem, workflowId: link.workflowId, clientName: link.workflow.clientName };

  const level = levelForLink(link.level)!;
  void prisma.workflowLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  const guest: GuestIdentity | null = decodeGuestCookie(input.guestCookie);
  return {
    ok: true,
    access: {
      workflowId: link.workflowId,
      source: { type: "link", id: link.id },
      needsName: !guest,
      identity: { displayName: guest?.name ?? null, verified: false, linkId: link.id, guestId: guest?.id, email: guest?.email },
      principal: {
        kind: "link",
        level,
        editMode: link.editMode === "suggest_only" ? "suggest_only" : "direct",
        canApprove: link.canApprove,
        // Shared Comment and Edit links allow comments; a View link never does.
        canComment: level !== "viewer",
        canAcceptSuggestions: false,
      },
    },
  };
}

/**
 * The first version of sharing gave each workflow ONE short link that anyone could use to look and sign off.
 * Those links keep working, as a View link that is allowed to approve (and may be pinned to a saved version).
 * Turning one off is still "Stop sharing" in the editor.
 */
async function resolveLegacy(input: ResolveInput): Promise<ResolveResult> {
  if (!/^[A-Za-z0-9_-]{10,16}$/.test(input.token)) return { ok: false, problem: "not_found" };
  const workflow = await prisma.workflowProject.findUnique({
    where: { shareToken: input.token },
    select: { id: true, shareVersionId: true },
  });
  if (!workflow) return { ok: false, problem: "not_found" };
  const guest = decodeGuestCookie(input.guestCookie);
  return {
    ok: true,
    access: {
      workflowId: workflow.id,
      source: { type: "legacy", id: workflow.id },
      pinnedVersionId: workflow.shareVersionId,
      needsName: !guest,
      identity: { displayName: guest?.name ?? null, verified: false, guestId: guest?.id, email: guest?.email },
      principal: { kind: "link", level: "viewer", editMode: "direct", canApprove: true, canComment: false, canAcceptSuggestions: false },
    },
  };
}

/** Plain-English text for a problem, for the friendly "this link does not work" page. */
export function problemMessage(problem: AccessProblem | "not_found"): { title: string; body: string; canRequestAccess: boolean } {
  switch (problem) {
    case "revoked":
      return { title: "This invite is no longer active", body: "The person who shared it has turned it off.", canRequestAccess: true };
    case "disabled":
      return { title: "This link has been turned off", body: "The person who shared it has switched it off or replaced it with a new one.", canRequestAccess: true };
    case "expired":
      return { title: "This link has expired", body: "Links stop working after a set time. Ask for a new one.", canRequestAccess: true };
    case "restricted":
      return { title: "This workflow is not shared by link", body: "Only people who were invited by name can open it.", canRequestAccess: true };
    case "passcode_required":
      return { title: "Enter the passcode", body: "This link is protected with a passcode.", canRequestAccess: false };
    case "wrong_passcode":
      return { title: "That passcode is not right", body: "Check it and try again.", canRequestAccess: false };
    case "unknown_level":
    case "not_found":
    default:
      return { title: "We could not find this page", body: "The link may be mistyped or may never have worked.", canRequestAccess: false };
  }
}
