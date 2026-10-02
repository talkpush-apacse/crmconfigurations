"use client";

import { useState } from "react";
import { Bot, History, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { describeActivity } from "@/lib/tracker/activity-text";
import { formatDate } from "@/lib/tracker/format";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { listActivity } from "@/lib/tracker/activity-service";
import { EmptyState, ErrorBlock, LoadingBlock } from "./PageHeader";

type ActivityPage = Awaited<ReturnType<typeof listActivity>>;
type Entry = ActivityPage["entries"][number];

function dayLabel(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  return day === today ? "Today" : formatDate(day);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A readable change history. `refreshKey` changes whenever the project reloads, so this stays current. */
export function ActivityView({ projectId, today, refreshKey }: { projectId: string; today: string; refreshKey: string }) {
  const first = useApiResource<ActivityPage>(`/api/tracker/projects/${projectId}/activity?limit=30&k=${encodeURIComponent(refreshKey)}`);
  const [older, setOlder] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<{ next: string | null; for: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (first.error) return <ErrorBlock message={first.error} onRetry={first.reload} />;
  if (!first.data) return <LoadingBlock label="Loading activity" />;

  // When the first page refreshes, the "older" pages we appended no longer line up, so ignore them.
  const stale = cursor !== null && cursor.for !== first.data.nextBefore;
  const entries = stale ? first.data.entries : [...first.data.entries, ...older];
  const nextBefore = stale || cursor === null ? first.data.nextBefore : cursor.next;

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoading(true);
    setError("");
    try {
      const page = await api<ActivityPage>(`/api/tracker/projects/${projectId}/activity?limit=30&before=${encodeURIComponent(nextBefore)}`);
      setOlder((prev) => (stale ? page.entries : [...prev, ...page.entries]));
      setCursor({ next: page.nextBefore, for: first.data!.nextBefore as string });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (entries.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Changes to this project, made on the website or through Claude, show up here." />;
  }

  const groups: { label: string; rows: Entry[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.createdAt, today);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(e);
    else groups.push({ label, rows: [e] });
  }

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Project activity</h2>
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g.label}</h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {g.rows.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground" aria-hidden="true">
                  {e.via === "mcp" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{e.actorLabel}</span> {describeActivity(e)}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {timeLabel(e.createdAt)}
                    {e.via === "mcp" ? " · via Claude" : e.via === "client" ? " · by the client" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {nextBefore && (
        <Button variant="outline" onClick={loadMore} disabled={loading}>
          {loading ? "Loading..." : "Show older activity"}
        </Button>
      )}
    </div>
  );
}
