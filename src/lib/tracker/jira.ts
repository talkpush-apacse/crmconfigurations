/**
 * Jira ticket links on tracker items.
 *
 * One rule, shared by the item screen, the API and the Claude tools: a link must be a Talkpush Jira ticket
 * address, for example https://talkpush.atlassian.net/browse/TP-11000. Anything else is refused, which also
 * means a link we render can only ever point at that one site over https.
 *
 * Staff only. The client-safe view builds each item field by field (see visibility.ts) and never includes links.
 */

export const JIRA_HOST = "talkpush.atlassian.net";
export const JIRA_EXAMPLE_URL = `https://${JIRA_HOST}/browse/TP-11000`;
export const MAX_JIRA_LINKS = 20;

export interface JiraLink {
  /** The ticket key, for example TP-11000. */
  label: string;
  /** The normalised address: https, no query string, no fragment. */
  url: string;
}

const TICKET_PATH = /^\/browse\/([A-Za-z][A-Za-z0-9_]*-\d+)\/?$/;

export type JiraParse = { ok: true; link: JiraLink } | { ok: false; error: string };

/** Accepts a pasted address and returns the clean link, or a message a person can act on. */
export function parseJiraUrl(input: string): JiraParse {
  const raw = input.trim();
  if (raw === "") return { ok: false, error: "Paste a Jira ticket address." };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: `That is not a web address. Use the full ticket address, for example ${JIRA_EXAMPLE_URL}.` };
  }

  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== JIRA_HOST || url.username !== "" || url.password !== "" || url.port !== "") {
    return { ok: false, error: `Only Talkpush Jira tickets can be linked, for example ${JIRA_EXAMPLE_URL}.` };
  }

  const match = TICKET_PATH.exec(url.pathname);
  if (!match) {
    return { ok: false, error: `That address is not a ticket. It should look like ${JIRA_EXAMPLE_URL}.` };
  }

  const key = match[1].toUpperCase();
  return { ok: true, link: { label: key, url: `https://${JIRA_HOST}/browse/${key}` } };
}

/** Parse a list, drop repeats of the same ticket, and report the first problem. */
export function parseJiraUrls(inputs: readonly string[]): { ok: true; links: JiraLink[] } | { ok: false; error: string } {
  const links: JiraLink[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const parsed = parseJiraUrl(input);
    if (!parsed.ok) return { ok: false, error: `${input.trim() || "(empty)"}: ${parsed.error}` };
    if (seen.has(parsed.link.url)) continue;
    seen.add(parsed.link.url);
    links.push(parsed.link);
  }
  return { ok: true, links };
}

/** The addresses from a stored `links` value, ignoring anything that is not a {url} object. */
export function jiraUrlsOf(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((l) => (l && typeof l === "object" && typeof (l as { url?: unknown }).url === "string" ? [(l as { url: string }).url] : []));
}
