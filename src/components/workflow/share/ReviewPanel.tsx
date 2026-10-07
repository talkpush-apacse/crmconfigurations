"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffCommentsTab, { type StaffCommentsApi } from "@/components/workflow/comments/StaffCommentsTab";
import type { CommentTarget } from "@/components/workflow/comments/types";
import { countThreads, type PageInfo } from "@/lib/workflow/comment-view";
import { describeAuditAction } from "@/lib/workflow/audit-text";
import SuggestionsPanel from "@/components/workflow/client/SuggestionsPanel";
import { toast } from "@/components/workflow/ui/toast";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import type { SuggestionView } from "@/lib/workflow/access/suggestions-service";

interface ReviewData {
  status: string | null;
  revision: number;
  suggestions: SuggestionView[];
  feedback: { id: string; action: string; reviewerName: string; comment: string | null; createdAt: string; versionNumber: number | null }[];
  accessRequests: { id: string; name: string; email: string | null; message: string | null; status: string; createdAt: string }[];
  audit: { id: string; actorType: string; actorName: string | null; action: string; detail: Record<string, unknown>; createdAt: string }[];
}

type Tab = "comments" | "suggestions" | "decisions" | "requests" | "activity";


/** Everything that needs staff attention on one workflow, in one place. */
export default function ReviewPanel({
  workflowId,
  onClose,
  onCanvasChanged,
  comments,
  pages,
  target,
  onTarget,
  onJump,
}: {
  workflowId: string;
  onClose: () => void;
  /** Called after a suggestion was accepted, so the editor can reload the canvas it is showing. */
  onCanvasChanged: () => Promise<void>;
  /** The comments, kept fresh by the editor so the pins on the diagram and this list always agree. */
  comments: StaffCommentsApi;
  pages: PageInfo[];
  target: CommentTarget | null;
  onTarget: (t: CommentTarget | null) => void;
  onJump: (at: { pageId: string; nodeId: string | null; edgeId: string | null }) => void;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [tab, setTab] = useState<Tab>("comments");

  // A pin on the diagram was clicked: bring the comments forward, whichever tab was showing.
  useEffect(() => {
    if (target) setTab("comments");
  }, [target?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/review`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the review.");
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the review.");
    }
  }, [workflowId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function send(path: string, method: string, body?: unknown) {
    const res = await fetch(`/api/workflows/${workflowId}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
    return out;
  }

  async function resolveSuggestion(id: string, action: "accept" | "reject" | "withdraw"): Promise<string | null> {
    try {
      const out = await send(`/suggestions/${id}`, "POST", { action });
      if (out.status === "accepted") {
        await onCanvasChanged();
        toast.success("Suggestion accepted and applied to the diagram.");
      }
      await load();
      return out.status === "stale" ? (out.message ?? "That suggestion no longer fits.") : null;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not do that.");
      return null;
    }
  }

  const openComments = countThreads(comments.comments).open;
  const pending = data?.suggestions.filter((s) => s.status === "pending").length ?? 0;
  const openRequests = data?.accessRequests.filter((r) => r.status === "open").length ?? 0;

  const tabs: [Tab, string][] = [
    ["comments", `Comments${openComments ? ` (${openComments})` : ""}`],
    ["suggestions", `Suggestions${pending ? ` (${pending})` : ""}`],
    ["decisions", "Decisions"],
    ["requests", `Requests${openRequests ? ` (${openRequests})` : ""}`],
    ["activity", "Activity"],
  ];

  return (
    <aside aria-label="Review" className="flex h-full w-96 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:!w-[min(24rem,90vw)] max-md:shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Review</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close review"><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex shrink-0 overflow-x-auto border-b border-border" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-10 shrink-0 whitespace-nowrap border-b-2 px-3 text-xs ${tab === id ? "border-ring font-semibold text-foreground" : "border-transparent text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p role="alert" className="m-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {!data && !error && tab !== "comments" && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" /></div>}

        {tab === "comments" && <StaffCommentsTab api={comments} pages={pages} target={target} onTarget={onTarget} onJump={onJump} />}

        {data && tab === "suggestions" && (
          <div>
            <SuggestionsPanel suggestions={data.suggestions} canAccept onResolve={resolveSuggestion} />
            {[...new Set(data.suggestions.filter((s) => s.status === "pending").map((s) => s.authorName))].map((author) => (
              <div key={author} className="px-3 pb-3">
                <Button size="sm" variant="outline" onClick={async () => { try { await send("/suggestions", "POST", { action: "accept_all", authorName: author }); await onCanvasChanged(); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not accept."); } }}>
                  <Check className="h-3.5 w-3.5" />Accept all from {author}
                </Button>
              </div>
            ))}
          </div>
        )}

        {data && tab === "decisions" && (
          <ul className="space-y-3 p-3">
            {data.feedback.length === 0 && <li className="text-sm text-muted-foreground">No one has approved or asked for changes yet.</li>}
            {data.feedback.map((f) => (
              <li key={f.id} className="rounded-lg border border-border p-3 text-sm">
                <p><strong>{f.reviewerName}</strong> {f.action === "approved" ? "approved" : "asked for changes"}{f.versionNumber ? ` on version ${f.versionNumber}` : ""}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(f.createdAt, { addSuffix: true })}</p>
                {f.comment && <p className="mt-1 whitespace-pre-wrap">{f.comment}</p>}
              </li>
            ))}
            {data.status === "modified_since_approval" && <li className="rounded-lg bg-brand-amber/15 p-3 text-sm text-foreground">The diagram changed after it was approved. Publish a new version and ask for approval again.</li>}
          </ul>
        )}

        {data && tab === "requests" && (
          <ul className="space-y-3 p-3">
            {data.accessRequests.length === 0 && <li className="text-sm text-muted-foreground">No one has asked for access.</li>}
            {data.accessRequests.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <p><strong>{r.name}</strong>{r.email ? ` · ${r.email}` : ""}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(r.createdAt, { addSuffix: true })}</p>
                {r.message && <p className="mt-1 whitespace-pre-wrap">{r.message}</p>}
                <div className="mt-2">
                  <Button size="sm" variant={r.status === "open" ? "outline" : "ghost"} onClick={async () => { await send(`/access-requests/${r.id}`, "PATCH", { status: r.status === "open" ? "handled" : "open" }); await load(); }}>
                    {r.status === "open" ? "Mark as handled" : "Reopen"}
                  </Button>
                </div>
              </li>
            ))}
            <li className="text-xs text-muted-foreground">To give them access, open Share and create a link or an invite, then send it yourself.</li>
          </ul>
        )}

        {data && tab === "activity" && (
          <ul className="divide-y divide-border/60 p-3 text-sm">
            {data.audit.length === 0 && <li className="py-2 text-muted-foreground">Nothing yet.</li>}
            {data.audit.map((a) => (
              <li key={a.id} className="py-2">
                <p><strong>{a.actorName ?? (a.actorType === "system" ? "System" : "Someone")}</strong> {describeAuditAction(a.action, a.detail)}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(a.createdAt, { addSuffix: true })}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
