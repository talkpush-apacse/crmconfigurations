"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommentThread, NewComment } from "@/components/workflow/client/CommentsPanel";
import { toast } from "@/components/workflow/ui/toast";
import { cn } from "@/lib/utils";
import { countThreads, describeCommentTarget, groupComments, type CommentFilter, type CommentGroup, type PageInfo } from "@/lib/workflow/comment-view";
import type { CommentView } from "@/lib/workflow/access/comments-service";
import type { CommentTarget } from "./types";

export interface StaffCommentsApi {
  comments: CommentView[];
  post: (input: { pageId: string; nodeId?: string; edgeId?: string; parentId?: string; body: string }) => Promise<void>;
  setStatus: (id: string, status: "open" | "resolved") => Promise<void>;
}

const FILTERS: [CommentFilter, string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["all", "All"],
];

const flatten = (g: CommentGroup<CommentView>) => g.threads.flatMap((t) => [t.root, ...t.replies]);

/**
 * Staff view of the comments: grouped by the step they are about (named and numbered like the diagram), filtered by
 * open or resolved. Opened from a pin on the diagram, it shows just that step with a box to add to the conversation.
 */
export default function StaffCommentsTab({
  api,
  pages,
  target,
  onTarget,
  onJump,
}: {
  api: StaffCommentsApi;
  pages: PageInfo[];
  target: CommentTarget | null;
  onTarget: (t: CommentTarget | null) => void;
  /** Bring that step (or connector) into view on the diagram. */
  onJump: (at: { pageId: string; nodeId: string | null; edgeId: string | null }) => void;
}) {
  const [filter, setFilter] = useState<CommentFilter>("open");
  const counts = useMemo(() => countThreads(api.comments), [api.comments]);
  const showPage = pages.length > 1;

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not do that.");
    }
  }
  const onReply = async (parentId: string, body: string) => {
    const parent = api.comments.find((c) => c.id === parentId);
    if (!parent) return;
    await api.post({ pageId: parent.pageId, nodeId: parent.nodeId ?? undefined, edgeId: parent.edgeId ?? undefined, parentId, body });
  };
  const onSetStatus = (id: string, status: "open" | "resolved") => run(() => api.setStatus(id, status));

  // ── One step, opened from a pin ────────────────────────────────────────────
  if (target?.mode === "focus") {
    const here = describeCommentTarget(pages, target);
    const group = groupComments(api.comments, pages, "all").find((g) => g.pageId === target.pageId && g.nodeId === target.nodeId && g.edgeId === target.edgeId);
    const threads = group ? [...group.threads].sort((a, b) => Number(a.root.status === "resolved") - Number(b.root.status === "resolved")) : [];
    const noun = target.nodeId ? "step" : target.edgeId ? "connector" : "page";
    return (
      <div className="space-y-3 p-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onTarget(null)}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All comments
        </Button>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{here.title}</h3>
          {showPage && <p className="text-xs text-muted-foreground">{here.pageName}</p>}
        </div>
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments on this {noun} yet.</p>
        ) : (
          <CommentThread comments={threads.flatMap((t) => [t.root, ...t.replies])} canComment canResolveAny onReply={onReply} onSetStatus={onSetStatus} />
        )}
        <NewComment
          placeholder={`Comment on this ${noun}`}
          onSend={(body) => api.post({ pageId: target.pageId, nodeId: target.nodeId ?? undefined, edgeId: target.edgeId ?? undefined, body })}
        />
      </div>
    );
  }

  // ── Everything, grouped by step ────────────────────────────────────────────
  const groups = groupComments(api.comments, pages, filter);
  const counted: Record<CommentFilter, number> = { open: counts.open, resolved: counts.resolved, all: counts.all };
  return (
    <div className="space-y-3 p-3">
      <div role="group" aria-label="Show comments" className="flex gap-1">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "min-h-8 rounded-full border px-3 text-xs transition-colors",
              filter === id ? "border-teal-600 bg-teal-50 font-semibold text-teal-900" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {label} <span className="tabular-nums">{counted[id]}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {counts.all === 0
            ? "No comments yet. When someone comments on a step, a numbered pin appears on it in the diagram."
            : filter === "open"
              ? "Nothing open. Every comment has been resolved; switch to Resolved to read them."
              : "No resolved comments yet."}
        </p>
      )}

      {groups.map((g) => {
        const here = target?.mode === "peek" && target.pageId === g.pageId && target.nodeId === g.nodeId && target.edgeId === g.edgeId;
        const canJump = g.kind === "step" || g.kind === "connector";
        return (
          <section key={g.key} aria-label={g.title} className={cn("space-y-2 rounded-lg", here && "bg-amber-50 p-2 ring-2 ring-amber-300")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                {showPage && <p className="text-xs text-muted-foreground">{g.pageName}</p>}
              </div>
              {canJump && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    onJump({ pageId: g.pageId, nodeId: g.nodeId, edgeId: g.edgeId });
                    onTarget({ pageId: g.pageId, nodeId: g.nodeId, edgeId: g.edgeId, mode: "peek", nonce: Date.now() });
                  }}
                  aria-label={`Show ${g.title} on the diagram`}
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Show
                </Button>
              )}
            </div>
            <CommentThread comments={flatten(g)} canComment canResolveAny onReply={onReply} onSetStatus={onSetStatus} />
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">Resolved comments move under Resolved. You can reopen them there.</p>
    </div>
  );
}
