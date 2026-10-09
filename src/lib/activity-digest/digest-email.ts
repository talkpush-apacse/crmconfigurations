import { renderEmail, type EmailBlock, type RichText } from "../email-template";
import { type SlotDate, sinceWord } from "./window";
import type { DigestArea, DigestAreaSummary, DigestNote } from "./types";

/** The daily digest email. Pure: counts, wording and layout are all decided here and tested. */

const AREA_TITLE: Record<DigestArea, string> = { tracker: "Project trackers", workflow: "Workflows", checklist: "Checklists" };
const AREA_NOUN: Record<DigestArea, [string, string]> = { tracker: ["project", "projects"], workflow: ["workflow", "workflows"], checklist: ["checklist", "checklists"] };
const AREA_ORDER: DigestArea[] = ["tracker", "workflow", "checklist"];

export interface DigestEmailInput {
  /** One summary per area. Missing areas are treated as empty. */
  areas: DigestAreaSummary[];
  /** Areas whose data could not be loaded at all. They are named in the email instead of silently shown as empty. */
  failedAreas: DigestArea[];
  notes: DigestNote[];
  slot: SlotDate;
  /** The Hub's staff address, for example https://crmconfig.talkpush.com. Empty means: no links and no button. */
  appBaseUrl: string;
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
  totalChanges: number;
}

const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

function join(base: string, path: string): string | undefined {
  const b = base.trim().replace(/\/+$/, "");
  return b ? `${b}${path}` : undefined;
}

function preheaderFor(areas: DigestAreaSummary[], failed: DigestArea[]): string {
  const titles = AREA_ORDER.flatMap((a) => areas.find((x) => x.area === a)?.groups.slice(0, 2).map((g) => g.title) ?? []);
  if (titles.length === 0) return failed.length > 0 ? "Nothing to list. Some changes could not be loaded." : "Nothing changed.";
  const joined = titles.slice(0, 4).join(", ");
  return joined.length <= 90 ? joined : `${joined.slice(0, 87).trimEnd()}...`;
}

export function buildActivityDigestEmail(input: DigestEmailInput): DigestEmail {
  const byArea = new Map(input.areas.map((a) => [a.area, a]));
  const total = AREA_ORDER.reduce((sum, a) => sum + (byArea.get(a)?.total ?? 0), 0);
  const since = sinceWord(input.slot);

  const subject = total === 0 ? `Hub activity: no changes found since ${since}` : `Hub activity: ${changes(total)} since ${since}`;
  const headline =
    total === 0 ? `No changes were found in the Hub since ${since} at 8:00 am` : `${changes(total)} ${total === 1 ? "was" : "were"} made in the Hub since ${since} at 8:00 am`;

  const blocks: EmailBlock[] = [
    {
      type: "details",
      rows: AREA_ORDER.map((a) => ({
        label: AREA_TITLE[a],
        value: input.failedAreas.includes(a) ? "Could not be loaded" : (byArea.get(a)?.total ?? 0) === 0 ? "No changes" : changes(byArea.get(a)!.total),
      })),
    },
  ];

  for (const n of input.notes.filter((x) => x.tone === "note")) blocks.push({ type: "callout", tone: "note", text: n.text });

  for (const a of AREA_ORDER) {
    const area = byArea.get(a);
    if (!area || area.total === 0) continue;
    blocks.push({ type: "heading", text: AREA_TITLE[a] });
    blocks.push({
      type: "bullets",
      groups: area.groups.map((g) => ({ title: g.title, subtitle: g.subtitle, titleUrl: join(input.appBaseUrl, g.path), items: g.items as RichText[], more: g.more })),
    });
    if (area.hiddenGroups > 0) {
      const [one, many] = AREA_NOUN[a];
      blocks.push({ type: "paragraph", text: `And ${area.hiddenGroups} more ${area.hiddenGroups === 1 ? one : many} with changes. Open the Hub to see them.` });
    }
  }

  for (const n of input.notes.filter((x) => x.tone === "info")) blocks.push({ type: "callout", tone: "info", text: n.text });

  const email = renderEmail(
    {
      preheader: preheaderFor(input.areas, input.failedAreas),
      eyebrow: "Daily activity",
      headline,
      blocks,
      button: { label: "Open the Hub", url: input.appBaseUrl.trim().replace(/\/+$/, "") },
      footer: [
        "You are getting this every weekday at 8:00 am Manila time because you are a super admin of the Talkpush Implementation Hub. To stop it, remove ACTIVITY_DIGEST_TO in the Vercel settings.",
      ],
    },
    subject
  );
  return { subject, html: email.html, text: email.text, totalChanges: total };
}
