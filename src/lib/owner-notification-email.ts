import { renderEmail, type RenderedEmail } from "./email-template";

/** The "a client changed your checklist" email, sent to the checklist owner. Pure, so the wording is easy to test. */

export type OwnerUpdateType = "Edited" | "File uploaded";

const whenFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

/** "7 Oct 2026, 11:42 UTC". Always UTC and always says so, because owners are in different time zones. */
export function formatWhen(date: Date): string {
  return `${whenFormat.format(date)} UTC`;
}

/** The hidden inbox preview line: the summary, kept short enough to show in full on a phone. */
function preview(summary: string): string {
  const flat = summary.replace(/\s+/g, " ").trim();
  return flat.length <= 90 ? flat : `${flat.slice(0, 87).trimEnd()}...`;
}

export interface OwnerNotificationEmail extends RenderedEmail {
  subject: string;
}

export function buildOwnerNotificationEmail(params: {
  clientName: string;
  tabDisplayName: string;
  tabUrl: string;
  updateType: OwnerUpdateType;
  summary: string;
  when?: Date;
}): OwnerNotificationEmail {
  const subject =
    params.updateType === "File uploaded"
      ? `${params.clientName} uploaded a file to the ${params.tabDisplayName} tab`
      : `${params.clientName} updated the ${params.tabDisplayName} tab`;
  const email = renderEmail(
    {
      preheader: preview(params.summary),
      eyebrow: "Checklist update",
      headline: subject,
      blocks: [
        {
          type: "details",
          rows: [
            { label: "Checklist", value: params.clientName },
            { label: "Tab", value: params.tabDisplayName },
            { label: "Change", value: params.updateType },
            { label: "What changed", value: params.summary },
            { label: "When", value: formatWhen(params.when ?? new Date()) },
          ],
        },
      ],
      button: { label: `Open the ${params.tabDisplayName} tab`, url: params.tabUrl },
      footer: `You are getting this because you own the ${params.clientName} checklist. To stop these emails, ask a Talkpush Admin to clear the owner email on the checklist.`,
    },
    subject
  );
  return { subject, ...email };
}
