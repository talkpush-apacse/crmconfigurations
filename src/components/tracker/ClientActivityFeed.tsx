"use client";

import { useEffect, useState } from "react";

/**
 * The activity trail on the client pages: who changed what, and when. The server decides what may be shown
 * (client-activity.ts is an allow-list), so this only draws it. Used by view-only links and contributor links.
 */

export interface ActivityEntryDTO {
  id: string;
  at: string;
  who: string;
  side: "talkpush" | "client";
  itemId: string | null;
  itemTitle: string | null;
  text: string;
  quote: string | null;
}

type State = { kind: "loading" } | { kind: "ready"; entries: ActivityEntryDTO[] } | { kind: "error"; message: string };

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

function dayLabel(at: string, now = new Date()): string {
  const d = new Date(at);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return sameDay(d, yesterday) ? "Yesterday" : dayFormat.format(d);
}

export function ClientActivityFeed({ url, emptyText = "Nothing has changed yet. Changes and comments will show here." }: { url: string; emptyText?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 429 ? "Please try again in a few minutes." : "The history could not be loaded.");
        return (await res.json()) as { entries: ActivityEntryDTO[] };
      })
      .then((data) => !cancelled && setState({ kind: "ready", entries: data.entries }))
      .catch((err) => !cancelled && setState({ kind: "error", message: err instanceof Error ? err.message : "The history could not be loaded." }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.kind === "loading") {
    return (
      <p role="status" className="py-6 text-center text-sm text-[var(--es-muted)]">
        Loading
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p role="alert" className="py-6 text-center text-sm text-[var(--es-red)]">
        {state.message}
      </p>
    );
  }
  if (state.entries.length === 0) {
    return <p className="rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] px-4 py-8 text-center text-sm text-[var(--es-muted)]">{emptyText}</p>;
  }

  const groups: { label: string; entries: ActivityEntryDTO[] }[] = [];
  for (const entry of state.entries) {
    const label = dayLabel(entry.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--es-muted)]">{group.label}</h3>
          <ol className="divide-y divide-[var(--es-line)] overflow-hidden rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)]">
            {group.entries.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${e.side === "talkpush" ? "bg-[var(--es-ink)] text-white" : "border border-[var(--es-line)] bg-[var(--es-stripe)] text-[var(--es-ink)]"}`}
                >
                  {e.side === "talkpush" ? "T" : e.who.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-semibold">{e.who}</span> {e.text}
                  </p>
                  {e.quote && <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-[var(--es-line)] pl-3 text-[var(--es-muted)]">{e.quote}</blockquote>}
                  <p className="mt-0.5 text-xs tabular-nums text-[var(--es-muted)]">
                    {timeFormat.format(new Date(e.at)).toLowerCase()}
                    {e.side === "client" ? " · Client" : " · Talkpush"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
