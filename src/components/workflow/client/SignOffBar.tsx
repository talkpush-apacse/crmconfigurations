"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Approve / request changes. The decision is tied to the version the person is looking at, which the page tells
 * the server (a published version, or a snapshot of the live work).
 */
export default function SignOffBar({
  latest,
  disabled,
  onSubmit,
  sticky,
}: {
  latest: { action: string; versionNumber: number | null; createdAt: string | Date } | null;
  disabled?: boolean;
  onSubmit: (action: "approved" | "changes_requested", comment?: string) => Promise<void>;
  sticky?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "approved" | "changes_requested">(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "approved" | "changes_requested") {
    setBusy(action);
    setError(null);
    try {
      await onSubmit(action, action === "changes_requested" ? comment : undefined);
      setMode("idle");
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your answer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Review and sign off"
      className={`border-t border-border bg-card px-4 py-3 ${sticky ? "sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" : ""}`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        {latest && (
          <p className="text-xs text-muted-foreground" role="status">
            Latest decision: <strong className="text-foreground">{latest.action === "approved" ? "Approved" : "Changes requested"}</strong>
            {latest.versionNumber ? ` on version ${latest.versionNumber}` : ""}
          </p>
        )}
        {mode === "idle" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={disabled || busy !== null} onClick={() => send("approved")} className="min-h-11">
              {busy === "approved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </Button>
            <Button variant="outline" disabled={disabled || busy !== null} onClick={() => setMode("changes")} className="min-h-11">
              <MessageSquareWarning className="h-4 w-4" />
              Request changes
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="wf-changes">What needs to change?</label>
            <textarea
              id="wf-changes"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              autoFocus
            />
            <div className="flex gap-2">
              <Button disabled={!comment.trim() || busy !== null} onClick={() => send("changes_requested")} className="min-h-11">
                {busy === "changes_requested" && <Loader2 className="h-4 w-4 animate-spin" />}
                Send
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")} className="min-h-11">Cancel</Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
