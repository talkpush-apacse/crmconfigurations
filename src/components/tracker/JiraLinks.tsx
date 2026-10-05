"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JIRA_EXAMPLE_URL, MAX_JIRA_LINKS, parseJiraUrl, type JiraLink } from "@/lib/tracker/jira";
import { Field } from "./Field";

/** The Jira tickets stored on an item, ignoring anything that is not a {label, url} pair. */
export function jiraLinksOf(links: unknown): JiraLink[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((l) => {
    const url = l && typeof l === "object" ? (l as { url?: unknown }).url : null;
    if (typeof url !== "string") return [];
    const parsed = parseJiraUrl(url);
    return parsed.ok ? [parsed.link] : [];
  });
}

/** Read-only ticket links for list rows. Staff screens only: client views never receive these. */
export function JiraLinkChips({ links }: { links: JiraLink[] }) {
  if (links.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex min-h-6 items-center gap-1 text-xs font-medium text-foreground underline underline-offset-4"
        >
          {l.label}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(opens Jira in a new tab)</span>
        </a>
      ))}
    </span>
  );
}

/**
 * Edit the Jira tickets on an item. A ticket is added by pasting its address; anything that is not a
 * talkpush.atlassian.net ticket is refused with a plain message. Text typed but not yet added is added on save.
 */
export function JiraLinksField({
  links,
  onChange,
  pending,
  onPendingChange,
}: {
  links: JiraLink[];
  onChange: (next: JiraLink[]) => void;
  pending: string;
  onPendingChange: (value: string) => void;
}) {
  const [error, setError] = useState("");

  const add = () => {
    const parsed = parseJiraUrl(pending);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    if (!links.some((l) => l.url === parsed.link.url)) onChange([...links, parsed.link]);
    onPendingChange("");
  };

  const atLimit = links.length >= MAX_JIRA_LINKS;

  return (
    <Field
      label="Jira tickets"
      htmlFor="item-jira"
      hint="Only the Talkpush team sees these. Clients never do. An item can have more than one ticket."
    >
      {links.length > 0 && (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.url} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 text-sm font-medium underline underline-offset-4"
              >
                {l.label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">(opens Jira in a new tab)</span>
              </a>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${l.label}`} onClick={() => onChange(links.filter((x) => x.url !== l.url))}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id="item-jira"
          type="url"
          inputMode="url"
          value={pending}
          placeholder={JIRA_EXAMPLE_URL}
          disabled={atLimit}
          onChange={(e) => {
            onPendingChange(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (pending.trim() !== "") add();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "item-jira-error" : undefined}
        />
        <Button type="button" variant="outline" onClick={add} disabled={atLimit || pending.trim() === ""}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {error && (
        <p id="item-jira-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Field>
  );
}
