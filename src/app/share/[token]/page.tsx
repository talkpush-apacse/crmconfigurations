"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExecSummary } from "@/components/tracker/ExecSummary";
import type { ClientView } from "@/lib/tracker/client-view";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: ClientView }
  | { kind: "unavailable" }
  | { kind: "busy" };

/**
 * The page a client opens from their private link. Read-only, no sign-in, no
 * staff chrome. Uses the executive-report palette (es-client) only.
 */
export default function SharedProjectPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share/${encodeURIComponent(token)}`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 429) return setState({ kind: "busy" });
        if (!res.ok) return setState({ kind: "unavailable" });
        setState({ kind: "ready", data: (await res.json()) as ClientView });
      })
      .catch(() => !cancelled && setState({ kind: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="es-client min-h-screen">
      <header className="border-b border-[var(--es-line)] bg-[var(--es-card)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-8">
          {/* Plain typeset name: the official logo lockup has not been supplied yet, and the brand rules forbid drawing one. */}
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--es-ink)]">Talkpush</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {state.kind === "loading" && (
          <div className="flex justify-center py-24" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--es-ink)] border-t-transparent" aria-hidden="true" />
            <span className="sr-only">Loading project status</span>
          </div>
        )}

        {state.kind === "ready" && <ExecSummary data={state.data} context="client" />}

        {state.kind === "unavailable" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">This link is not available</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">It may have expired or been replaced. Please ask your Talkpush contact for a new link.</p>
          </div>
        )}

        {state.kind === "busy" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Please try again in a few minutes</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">This page has had a lot of requests from your connection.</p>
          </div>
        )}
      </main>
    </div>
  );
}
