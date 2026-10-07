"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentView } from "@/lib/workflow/access/comments-service";

const POLL_MS = 20_000;

/**
 * The comments on one workflow, kept fresh while the editor is open so the pins on the diagram and the Review panel
 * always show the same thing. Reloads on its own every 20 seconds (paused while the tab is hidden) and right after
 * anything staff change.
 */
export function useStaffComments(workflowId: string) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/comments`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load comments.");
      if (!alive.current) return;
      setComments(body.comments ?? []);
      setError(null);
      setLoaded(true);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Could not load comments.");
    }
  }, [workflowId]);

  useEffect(() => {
    alive.current = true;
    void reload();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [reload]);

  async function send(path: string, method: string, body: unknown) {
    const res = await fetch(`/api/workflows/${workflowId}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
    await reload();
  }

  /** Start a thread on a step or a page, or reply to one. */
  const post = (input: { pageId: string; nodeId?: string; edgeId?: string; parentId?: string; body: string }) => send("/comments", "POST", input);
  const setStatus = (id: string, status: "open" | "resolved") => send(`/comments/${id}`, "PATCH", { status });

  return { comments, error, loaded, reload, post, setStatus };
}
