"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, History as HistoryIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import type { EditEventRow, EditPerson, EditTabOption } from "@/lib/edit-history/types";

/**
 * Who changed what, newest first. Staff only. Filter by person and by tab; open a line to see before and after.
 * Everything here is shown as plain text (never as HTML), because the values come from clients.
 */

interface Overview {
  people: EditPerson[];
  tabs: EditTabOption[];
  firstRecordedAt: string | null;
  possiblyMissing: string[];
}
interface Page {
  events: EditEventRow[];
  nextCursor: string | null;
  overview: Overview | null;
}
interface Detail {
  before: unknown;
  after: unknown;
}

const VERB: Record<string, string> = {
  edited: "changed",
  added: "added to",
  deleted: "deleted from",
  restored: "restored in",
  reordered: "reordered rows in",
  replaced: "replaced",
  setup: "changed the setup of",
  file: "changed attachments on",
};

const KIND_TAG: Record<string, string | null> = {
  link: "named link",
  legacy_link: "shared link",
  slug: "client form link",
  admin: "staff",
  mcp: "Claude",
  system: null,
};

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** The part that differs, found by trimming what both texts share at the start and the end. */
function splitDiff(before: string, after: string) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  return {
    prefix: before.slice(0, start),
    beforeMid: before.slice(start, endB),
    afterMid: after.slice(start, endA),
    suffix: before.slice(endB),
  };
}

function Sentence({ e }: { e: EditEventRow }) {
  if (e.changeType === "system") return <span className="font-medium">{e.actorName}: {e.summary}</span>;
  const parts = [e.tabLabel, e.rowLabel, e.fieldLabel].filter(Boolean);
  const tag = KIND_TAG[e.actorType];
  return (
    <span>
      <span className="font-semibold">{e.actorName}</span>
      {tag && <span className="ml-1 text-xs text-muted-foreground">({tag})</span>}{" "}
      {VERB[e.changeType] ?? "changed"} <span className="font-medium">{parts.join(", ")}</span>
    </span>
  );
}

function DetailView({ detail }: { detail: Detail }) {
  const b = asText(detail.before);
  const a = asText(detail.after);
  if (!b && !a) {
    return <p className="text-sm text-muted-foreground">The values were not kept for this change (for example a password, or too much text).</p>;
  }
  const d = splitDiff(b, a);
  const box = "max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 font-mono text-xs";
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before</p>
        <div className={box}>
          {b ? (
            <>
              {d.prefix}
              <mark className="rounded bg-destructive/15 px-0.5 text-foreground line-through">{d.beforeMid}</mark>
              {d.suffix}
            </>
          ) : (
            <span className="text-muted-foreground">(empty)</span>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">After</p>
        <div className={box}>
          {a ? (
            <>
              {d.prefix}
              <mark className="rounded bg-brand-sage/40 px-0.5 text-foreground">{d.afterMid}</mark>
              {d.suffix}
            </>
          ) : (
            <span className="text-muted-foreground">(empty)</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [events, setEvents] = useState<EditEventRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, Detail | "loading" | "error">>({});

  const query = useCallback(
    (cursor?: string | null) => {
      const q = new URLSearchParams();
      if (person) q.set("person", person);
      if (tab) q.set("tab", tab);
      if (cursor) q.set("cursor", cursor);
      return `/api/checklists/${id}/edit-history?${q.toString()}`;
    },
    [id, person, tab]
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(query(), { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as Partial<Page> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load the edit history.");
      setEvents(body.events ?? []);
      setNextCursor(body.nextCursor ?? null);
      // The filter lists come with the first page only; keep the full lists while a filter is on.
      if (body.overview) setOverview((prev) => (person || tab ? prev ?? body.overview! : body.overview!));
      setOpen({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the edit history.");
    } finally {
      setLoading(false);
    }
  }, [query, person, tab]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(query(nextCursor), { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as Partial<Page> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load more.");
      setEvents((prev) => [...prev, ...(body.events ?? [])]);
      setNextCursor(body.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggle(e: EditEventRow) {
    const isOpen = !open[e.id];
    setOpen((o) => ({ ...o, [e.id]: isOpen }));
    if (!isOpen || details[e.id] === "loading" || (details[e.id] && details[e.id] !== "error")) return;
    setDetails((d) => ({ ...d, [e.id]: "loading" }));
    try {
      const res = await fetch(`/api/checklists/${id}/edit-history/${e.id}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { event?: Detail };
      if (!res.ok || !body.event) throw new Error("failed");
      setDetails((d) => ({ ...d, [e.id]: { before: body.event!.before, after: body.event!.after } }));
    } catch {
      setDetails((d) => ({ ...d, [e.id]: "error" }));
    }
  }

  const filtered = !!(person || tab);
  const startedOn = useMemo(
    () => (overview?.firstRecordedAt ? new Date(overview.firstRecordedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null),
    [overview]
  );
  const select = "h-11 rounded-md border border-input bg-background px-3 text-sm md:h-9";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-[29px] font-bold tracking-[-0.03em] text-foreground">Edit history</h1>
        <p className="text-sm text-muted-foreground">Who changed what in this checklist, newest first. Only staff can see this page.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <p>
          {startedOn
            ? `Changes before ${startedOn} were not recorded.`
            : "Nothing has been recorded on this checklist yet. Changes are recorded from the moment this feature was turned on."}
        </p>
        <p>
          Not recorded: changes Claude makes with its other tools, applying a template, and the configurator. A link can be
          forwarded, so a name shows which link was used, not for certain who was typing.
        </p>
      </div>

      {overview && overview.possiblyMissing.length > 0 && (
        <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Some recent changes to <strong>{overview.possiblyMissing.join(", ")}</strong> may be missing from this list, so it may
            not show everything that changed there.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Person
          <select className={select} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {(overview?.people ?? []).map((p) => (
              <option key={p.key} value={p.key}>{p.label} ({p.count})</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Tab
          <select className={select} value={tab} onChange={(e) => setTab(e.target.value)}>
            <option value="">All tabs</option>
            {(overview?.tabs ?? []).map((t) => (
              <option key={t.tabKey} value={t.tabKey}>{t.tabLabel} ({t.count})</option>
            ))}
          </select>
        </label>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setPerson(""); setTab(""); }} className="h-11 md:h-9">Clear filters</Button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void loadFirst()}>Try again</Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading the edit history…
        </div>
      ) : events.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
          <HistoryIcon className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">{filtered ? "No changes match these filters" : "No changes recorded yet"}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {filtered
              ? "Try another person or tab."
              : "When someone changes this checklist through an edit link, you will see it here."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {events.map((e) => {
            const isOpen = !!open[e.id];
            const detail = details[e.id];
            // Only these kinds can carry before/after text; the rest are one-line facts.
            const canOpen = ["edited", "added", "deleted", "restored"].includes(e.changeType);
            return (
              <li key={e.id} className="p-3">
                <div className="flex items-start gap-2">
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => void toggle(e)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide details" : "Show before and after"}
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="size-7 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><Sentence e={e} /></p>
                    {e.changeType !== "edited" && e.changeType !== "system" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.summary}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground" title={new Date(e.updatedAt).toLocaleString()}>
                      {formatDistanceToNow(e.updatedAt, { addSuffix: true })}
                      {e.truncated ? " · some text was left out" : ""}
                    </p>
                  </div>
                </div>
                {isOpen && (
                  <div className="ml-9 mt-3">
                    {detail === "loading" || detail === undefined ? (
                      <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</p>
                    ) : detail === "error" ? (
                      <p className="text-sm text-destructive">Could not load the details. <button className="underline" onClick={() => { setDetails((d) => { const n = { ...d }; delete n[e.id]; return n; }); setOpen((o) => ({ ...o, [e.id]: false })); }}>Close and try again</button></p>
                    ) : (
                      <DetailView detail={detail} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore} className="h-11 md:h-9">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Show older changes
          </Button>
        </div>
      )}
    </div>
  );
}
