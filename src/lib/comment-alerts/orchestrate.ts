import { buildCommentAlertEmail, type CommentAlertKind } from "./comment-alert-email";

/**
 * The decide-and-send part of a comment alert. Pure apart from the pieces passed in (who receives it, how to look up
 * the place, how to send), so it can be tested without a database or an email account. Production wiring is in deliver.ts.
 */

export type CommentAlertEvent =
  | { kind: "workflow"; workflowId: string; authorName: string; body: string; isReply: boolean }
  | { kind: "tracker"; itemId: string; authorName: string; body: string };

export interface Place {
  placeName: string;
  companyName: string | null;
  itemTitle: string | null;
  path: string;
}

export interface DeliverDeps {
  recipient: () => Promise<string | null>;
  loadPlace: (event: CommentAlertEvent) => Promise<Place | null>;
  baseUrl: () => string;
  send: (message: { to: string; subject: string; html: string; text: string }) => Promise<{ ok: boolean; error?: string }>;
  now: () => Date;
}

/** Builds and sends one alert. Resolves to what happened, for tests; the caller in production ignores it. */
export async function deliverCommentAlert(event: CommentAlertEvent, deps: DeliverDeps): Promise<"sent" | "no-recipient" | "no-place" | "no-base-url" | "failed"> {
  const to = await deps.recipient();
  if (!to) return "no-recipient";
  const place = await deps.loadPlace(event);
  if (!place) return "no-place";
  const base = deps.baseUrl();
  if (!base) return "no-base-url";

  const kind: CommentAlertKind = event.kind;
  const email = buildCommentAlertEmail({
    kind,
    placeName: place.placeName,
    companyName: place.companyName,
    itemTitle: place.itemTitle,
    authorName: event.authorName,
    isReply: event.kind === "workflow" ? event.isReply : false,
    body: event.body,
    url: `${base}${place.path}`,
    when: deps.now(),
  });
  const result = await deps.send({ to, subject: email.subject, html: email.html, text: email.text });
  if (!result.ok) {
    console.error(`[comment-alert] send failed (${kind}): ${result.error ?? "unknown error"}`);
    return "failed";
  }
  return "sent";
}
