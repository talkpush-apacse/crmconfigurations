"use client";

import { useMemo, useState } from "react";
import { Check, CornerDownRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import type { CommentView } from "@/lib/workflow/access/comments-service";

/** A thread of comments (and replies) for one step, or for the whole workflow. */
export function CommentThread({
  comments,
  canComment,
  onReply,
  onSetStatus,
}: {
  comments: CommentView[];
  canComment: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onSetStatus: (id: string, status: "open" | "resolved") => Promise<void>;
}) {
  const roots = comments.filter((c) => !c.parentId);
  const replies = useMemo(() => {
    const map = new Map<string, CommentView[]>();
    for (const c of comments) if (c.parentId) map.set(c.parentId, [...(map.get(c.parentId) ?? []), c]);
    return map;
  }, [comments]);

  if (roots.length === 0) return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  return (
    <ul className="space-y-3">
      {roots.map((c) => (
        <li key={c.id} className="rounded-lg border border-border p-3">
          <CommentBody c={c} />
          {(replies.get(c.id) ?? []).map((r) => (
            <div key={r.id} className="mt-2 flex gap-2 border-l-2 border-border pl-3">
              <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <CommentBody c={r} />
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2">
            {canComment && <ReplyBox onSend={(body) => onReply(c.id, body)} />}
            {c.mine && (
              <Button variant="ghost" size="sm" onClick={() => onSetStatus(c.id, c.status === "resolved" ? "open" : "resolved")}>
                {c.status === "resolved" ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {c.status === "resolved" ? "Reopen" : "Resolve"}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CommentBody({ c }: { c: CommentView }) {
  return (
    <div className={`min-w-0 flex-1 text-sm ${c.status === "resolved" ? "opacity-60" : ""}`}>
      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{c.authorName}</strong> · {formatDistanceToNow(c.createdAt, { addSuffix: true })}
        {c.status === "resolved" && " · resolved"}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{c.body}</p>
    </div>
  );
}

function ReplyBox({ onSend }: { onSend: (body: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Reply</Button>;
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSend(body);
          setBody("");
          setOpen(false);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply" aria-label="Write a reply" maxLength={2000} autoFocus />
      <Button size="sm" type="submit" disabled={busy || !body.trim()}>Send</Button>
    </form>
  );
}

/** Add a comment (to the selected step, or to the whole page). */
export function NewComment({ placeholder, onSend }: { placeholder: string; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSend(body);
          setBody("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not send.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70" rows={2} placeholder={placeholder} aria-label={placeholder} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button size="sm" type="submit" disabled={busy || !body.trim()}>Comment</Button>
    </form>
  );
}
