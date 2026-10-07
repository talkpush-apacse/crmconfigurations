/**
 * The one look for every email the Hub sends: logo, brand strip, eyebrow, headline, body, one button, footer.
 * Pure (no server imports) so the wording and layout are easy to test.
 *
 * Email apps are not browsers: layout is tables, styles are inline, and a <style> block only adds dark mode and the
 * phone-width tweaks (apps that ignore it still show the light, full-width version). Everything a person typed is
 * escaped here, so callers pass plain text and never HTML.
 */

/** Plain text, or text to show in bold. The only inline formatting emails need. */
export type Segment = string | { strong: string } | { link: { text: string; url: string } };
export type RichText = string | Segment[];

export function strong(text: string): Segment {
  return { strong: text };
}

/** A link inside a sentence. Only web addresses are linked; anything else shows as plain text. */
export function link(text: string, url: string): Segment {
  return { link: { text, url } };
}

export type EmailBlock =
  | { type: "paragraph"; text: RichText }
  | { type: "steps"; items: RichText[] }
  | { type: "details"; rows: { label: string; value: string }[] }
  /** A small uppercase section label, for emails with several sections. */
  | { type: "heading"; text: string }
  /** Groups of bullet points, each group with a bold title (optionally a link) and an optional "and N more" line. */
  | { type: "bullets"; groups: { title: string; titleUrl?: string; subtitle?: string; items: RichText[]; more?: number }[] }
  /** "note" (amber) is for something that will trip people up. "info" (lavender) is for background. */
  | { type: "callout"; tone: "note" | "info"; text: RichText };

export interface EmailContent {
  /** Hidden preview line shown beside the subject in the inbox. Aim for 40 to 90 characters. */
  preheader: string;
  /** Small label saying what kind of email this is. */
  eyebrow: string;
  /** One sentence, sentence case, with a verb. */
  headline: string;
  blocks: EmailBlock[];
  /** Exactly one button per email. */
  button: { label: string; url: string };
  /** Always says why they got it and how to reach a person or stop it. */
  footer: RichText;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const FONT = "'Inter',-apple-system,'Segoe UI',Arial,Helvetica,sans-serif";
const INTER_CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap";
const STRIP = ["#ACCDB5", "#BBCAF0", "#E8C2EF", "#E8B766"];

const LIGHT = {
  page: "#FFFFF5",
  card: "#FFFFFF",
  line: "#E8E4D2",
  ink: "#141414",
  muted: "#6B6B6B",
  button: "#141414",
  buttonText: "#FFFFF5",
  badge: "#BBCAF0",
  noteBg: "#F4DBB2",
  noteBar: "#E8B766",
  infoBg: "#DFE5F7",
  infoBar: "#BBCAF0",
};

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function segments(text: RichText): Segment[] {
  return typeof text === "string" ? [text] : text;
}

/** Only web addresses become links. Anything else is shown as plain text so a bad value can never run as a link. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

function richHtml(text: RichText): string {
  return segments(text)
    .map((s) => {
      if (typeof s === "string") return escapeHtml(s);
      if ("strong" in s) return `<strong>${escapeHtml(s.strong)}</strong>`;
      const url = safeUrl(s.link.url);
      return url ? `<a href="${escapeHtml(url)}" style="color:inherit;text-decoration:underline;">${escapeHtml(s.link.text)}</a>` : escapeHtml(s.link.text);
    })
    .join("");
}

function richText(text: RichText): string {
  return segments(text)
    .map((s) => (typeof s === "string" ? s : "strong" in s ? s.strong : s.link.text))
    .join("");
}

/** The logo files live next to the Hub itself, so the address is derived from the button's own address. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function renderBlock(block: EmailBlock): string {
  const c = LIGHT;
  switch (block.type) {
    case "paragraph":
      return `<tr><td class="dm-ink" style="padding:0 0 16px;font:400 16px/1.6 ${FONT};color:${c.ink};">${richHtml(block.text)}</td></tr>`;

    case "steps": {
      const rows = block.items
        .map(
          (item, i) => `<tr><td style="padding:0 0 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="32" valign="top"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="28" height="28" bgcolor="${c.badge}" style="width:28px;height:28px;border-radius:14px;background:${c.badge};font:700 14px/28px ${FONT};color:#141414;">${i + 1}</td></tr></table></td>
<td class="dm-ink" valign="top" style="padding:3px 0 0 4px;font:400 16px/1.5 ${FONT};color:${c.ink};">${richHtml(item)}</td></tr></table></td></tr>`
        )
        .join("");
      return `<tr><td style="padding:4px 0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>`;
    }

    case "details": {
      const rows = block.rows
        .map(
          (r) => `<tr><td class="dm-line dm-muted" width="34%" valign="top" style="padding:12px 12px 12px 0;border-top:1px solid ${c.line};font:500 14px/1.5 ${FONT};color:${c.muted};">${escapeHtml(r.label)}</td>
<td class="dm-line dm-ink" valign="top" style="padding:12px 0;border-top:1px solid ${c.line};font:500 15px/1.5 ${FONT};color:${c.ink};">${escapeHtml(r.value)}</td></tr>`
        )
        .join("");
      return `<tr><td style="padding:0 0 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}<tr><td class="dm-line" colspan="2" style="border-top:1px solid ${c.line};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;
    }

    case "heading":
      return `<tr><td class="dm-muted" style="padding:12px 0 8px;font:700 12px/1.4 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${c.muted};">${escapeHtml(block.text)}</td></tr>`;

    case "bullets": {
      const groups = block.groups
        .map((g) => {
          const titleUrl = g.titleUrl ? safeUrl(g.titleUrl) : "";
          const title = titleUrl
            ? `<a class="dm-ink" href="${escapeHtml(titleUrl)}" style="color:${c.ink};text-decoration:underline;">${escapeHtml(g.title)}</a>`
            : escapeHtml(g.title);
          const sub = g.subtitle ? `<span class="dm-muted" style="font-weight:400;color:${c.muted};"> &middot; ${escapeHtml(g.subtitle)}</span>` : "";
          const items = g.items.map((item) => `<li style="margin:0 0 4px;">${richHtml(item)}</li>`).join("");
          const more = g.more && g.more > 0 ? `<li class="dm-muted" style="margin:0 0 4px;list-style:none;color:${c.muted};">and ${g.more} more</li>` : "";
          return `<div class="dm-ink" style="padding:0 0 14px;font:400 15px/1.5 ${FONT};color:${c.ink};"><div style="padding:0 0 4px;font-weight:700;">${title}${sub}</div><ul style="margin:0;padding:0 0 0 20px;">${items}${more}</ul></div>`;
        })
        .join("");
      return `<tr><td style="padding:0;">${groups}</td></tr>`;
    }

    case "callout": {
      const note = block.tone === "note";
      const bg = note ? c.noteBg : c.infoBg;
      const bar = note ? c.noteBar : c.infoBar;
      const cls = note ? "dm-note" : "dm-info";
      return `<tr><td style="padding:4px 0 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="${cls}-bar" width="4" bgcolor="${bar}" style="width:4px;background:${bar};font-size:0;line-height:0;">&nbsp;</td>
<td class="dm-ink ${cls}" bgcolor="${bg}" style="padding:14px 16px;background:${bg};border-radius:0 6px 6px 0;font:400 15px/1.5 ${FONT};color:${c.ink};">${richHtml(block.text)}</td></tr></table></td></tr>`;
    }
  }
}

function renderText(content: EmailContent): string {
  const out: string[] = [content.eyebrow.toUpperCase(), "", content.headline, ""];
  for (const block of content.blocks) {
    if (block.type === "paragraph" || block.type === "callout") out.push(richText(block.text), "");
    else if (block.type === "steps") out.push(...block.items.map((item, i) => `${i + 1}. ${richText(item)}`), "");
    else if (block.type === "heading") out.push(block.text.toUpperCase(), "");
    else if (block.type === "bullets") {
      for (const g of block.groups) {
        out.push(`${g.title}${g.subtitle ? ` \u00b7 ${g.subtitle}` : ""}${g.titleUrl && safeUrl(g.titleUrl) ? `: ${safeUrl(g.titleUrl)}` : ""}`);
        out.push(...g.items.map((item) => `- ${richText(item)}`));
        if (g.more && g.more > 0) out.push(`- and ${g.more} more`);
        out.push("");
      }
    } else out.push(...block.rows.map((r) => `${r.label}: ${r.value}`), "");
  }
  out.push(`${content.button.label}: ${content.button.url}`, "", richText(content.footer));
  return out.join("\n");
}

export function renderEmail(content: EmailContent, title: string): RenderedEmail {
  const c = LIGHT;
  const origin = originOf(content.button.url);
  const link = safeUrl(content.button.url);

  const logo = origin
    ? `<img class="logo-light" src="${origin}/email/talkpush-logo.png" width="150" alt="Talkpush" style="display:block;width:150px;height:auto;border:0;">
<img class="logo-dark" src="${origin}/email/talkpush-logo-dark.png" width="150" alt="Talkpush" style="display:none;width:150px;height:auto;border:0;max-height:0;overflow:hidden;">`
    : `<span class="dm-ink" style="font:700 22px/1 ${FONT};letter-spacing:-0.02em;color:${c.ink};">talkpush</span>`;

  const strip = STRIP.map((s) => `<td width="25%" height="6" bgcolor="${s}" style="height:6px;background:${s};font-size:0;line-height:0;">&nbsp;</td>`).join("");

  const button = link
    ? `<tr><td style="padding:8px 0 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="dm-btn" align="center" bgcolor="${c.button}" style="background:${c.button};border-radius:6px;"><a class="dm-btn-text" href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;font:700 16px/20px ${FONT};color:${c.buttonText};text-decoration:none;border-radius:6px;">${escapeHtml(content.button.label)}</a></td></tr></table></td></tr>
<tr><td class="dm-muted" style="padding:0 0 4px;font:400 13px/1.5 ${FONT};color:${c.muted};">Button not working? Paste this link into your browser: <a class="dm-muted" href="${escapeHtml(link)}" style="color:${c.muted};text-decoration:underline;">${escapeHtml(link)}</a></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<link href="${INTER_CSS_URL}" rel="stylesheet">
<style>
@media (max-width:620px){.outer-pad{padding:20px 12px !important}.card-pad{padding:28px 20px 24px !important}}
@media (prefers-color-scheme:dark){
.dm-page{background:#141416 !important}.dm-card{background:#1B1B1F !important;border-color:#34343A !important}
.dm-ink{color:#FFFFF5 !important}.dm-muted{color:#A7A7B0 !important}.dm-line{border-color:#34343A !important}
.dm-btn{background:#FFFFF5 !important}.dm-btn-text{color:#141414 !important}
.dm-note{background:#3A2E1A !important}.dm-info{background:#232536 !important}.dm-info-bar{background:#95A4DB !important}
.logo-light{display:none !important}.logo-dark{display:block !important;max-height:none !important}
}
</style>
</head>
<body class="dm-page" style="margin:0;padding:0;background:${c.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${c.page};">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-page" bgcolor="${c.page}" style="background:${c.page};">
<tr><td class="outer-pad" align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 0 16px;">${logo}</td></tr>
<tr><td class="dm-card" bgcolor="${c.card}" style="background:${c.card};border:1px solid ${c.line};border-radius:6px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${strip}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="card-pad" style="padding:36px 36px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="dm-muted" style="padding:0 0 10px;font:700 12px/1.4 ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:${c.muted};">${escapeHtml(content.eyebrow)}</td></tr>
<tr><td class="dm-ink" style="padding:0 0 20px;font:700 26px/1.25 ${FONT};letter-spacing:-0.02em;color:${c.ink};">${escapeHtml(content.headline)}</td></tr>
${content.blocks.map(renderBlock).join("\n")}
${button}
</table>
</td></tr></table>
</td></tr>
<tr><td class="dm-muted" style="padding:20px 4px 0;font:400 12px/1.6 ${FONT};color:${c.muted};">${richHtml(content.footer)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { html, text: renderText(content) };
}
