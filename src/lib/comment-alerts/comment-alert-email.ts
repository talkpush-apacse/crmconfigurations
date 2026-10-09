import { renderEmail, type RenderedEmail } from "../email-template";
import { formatWhen } from "../owner-notification-email";

/**
 * The "someone commented" email for the super admin. Pure, so the wording is easy to test.
 *
 * The subject uses only names staff typed (a workflow or project name), cleaned to one short line. It never uses the
 * commenter's name or the comment itself, because those can come from anyone holding a shared link.
 */

export type CommentAlertKind = "workflow" | "tracker";

export interface CommentAlertEmailInput {
  kind: CommentAlertKind;
  /** The workflow name, or the project title. */
  placeName: string;
  /** The company or client the place belongs to, when known. */
  companyName?: string | null;
  /** Tracker only: the item the comment is on. */
  itemTitle?: string | null;
  authorName: string;
  isReply: boolean;
  body: string;
  /** The full address of the staff page to open. */
  url: string;
  when?: Date;
}

const BODY_LIMIT = 600;

/** One short line: no line breaks or control characters, no runs of spaces, cut with "..." when long. */
export function oneLine(value: string, max: number): string {
  const flat = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 3).trimEnd()}...`;
}

/** The comment text for the email: line breaks kept, very long comments cut, so the email stays short. */
function commentText(body: string): string {
  const cleaned = body.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return cleaned.length <= BODY_LIMIT ? cleaned : `${cleaned.slice(0, BODY_LIMIT - 3).trimEnd()}...`;
}

export interface CommentAlertEmail extends RenderedEmail {
  subject: string;
}

export function buildCommentAlertEmail(input: CommentAlertEmailInput): CommentAlertEmail {
  const place = oneLine(input.placeName, 80) || (input.kind === "workflow" ? "a workflow" : "a project tracker");
  const noun = input.isReply ? "reply" : "comment";
  const subject = input.kind === "workflow" ? `New ${noun} on the workflow ${place}` : `New ${noun} in the tracker ${place}`;
  const who = oneLine(input.authorName, 60) || "Someone";
  const headline = input.kind === "workflow" ? `${who} left a ${noun} on a workflow` : `${who} left a ${noun} in a project tracker`;

  const rows: { label: string; value: string }[] = [];
  rows.push({ label: input.kind === "workflow" ? "Workflow" : "Project", value: place });
  if (input.companyName && oneLine(input.companyName, 80)) rows.push({ label: "Company", value: oneLine(input.companyName, 80) });
  if (input.kind === "tracker" && input.itemTitle && oneLine(input.itemTitle, 120)) rows.push({ label: "Item", value: oneLine(input.itemTitle, 120) });
  rows.push({ label: "From", value: who });
  rows.push({ label: input.isReply ? "Reply" : "Comment", value: commentText(input.body) });
  rows.push({ label: "When", value: formatWhen(input.when ?? new Date()) });

  const email = renderEmail(
    {
      preheader: oneLine(input.body, 90) || `${who} left a ${noun}`,
      eyebrow: "New comment",
      headline,
      blocks: [{ type: "details", rows }],
      button: { label: input.kind === "workflow" ? "Open the workflow" : "Open the project tracker", url: input.url },
      footer:
        "You are getting this because you are the Hub's activity recipient. Comments written by Talkpush staff while signed in, and internal notes, are not emailed.",
    },
    subject
  );
  return { subject, ...email };
}
