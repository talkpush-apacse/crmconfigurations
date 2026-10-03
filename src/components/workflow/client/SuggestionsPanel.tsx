"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import { describeOps } from "@/lib/workflow/suggestion-overlay";
import type { SuggestionView } from "@/lib/workflow/access/suggestions-service";

/** Pending suggestions: who proposed what, with accept / reject (if allowed) and withdraw (your own). */
export default function SuggestionsPanel({
  suggestions,
  canAccept,
  onResolve,
}: {
  suggestions: SuggestionView[];
  canAccept: boolean;
  onResolve: (id: string, action: "accept" | "reject" | "withdraw") => Promise<string | null>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (suggestions.length === 0) return <p className="p-3 text-sm text-muted-foreground">No suggestions waiting.</p>;

  async function act(id: string, action: "accept" | "reject" | "withdraw") {
    setBusy(id);
    setNotice(null);
    try {
      setNotice(await onResolve(id, action));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 p-3">
      {notice && <p role="status" className="rounded-md bg-secondary p-2 text-sm">{notice}</p>}
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <li key={s.id} className="rounded-lg border border-dashed border-emerald-500/60 p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{s.authorName}</strong> · {formatDistanceToNow(s.createdAt, { addSuffix: true })}
              {s.status === "stale" && " · no longer fits"}
            </p>
            <p className="mt-1 font-medium text-foreground">{s.summary || describeOps(s.ops)}</p>
            {s.summary && <p className="text-xs text-muted-foreground">{describeOps(s.ops)}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {canAccept && s.status === "pending" && (
                <>
                  <Button size="sm" disabled={busy === s.id} onClick={() => act(s.id, "accept")}><Check className="h-3.5 w-3.5" />Accept</Button>
                  <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => act(s.id, "reject")}><X className="h-3.5 w-3.5" />Reject</Button>
                </>
              )}
              {s.mine && s.status === "pending" && (
                <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => act(s.id, "withdraw")}>Withdraw</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
