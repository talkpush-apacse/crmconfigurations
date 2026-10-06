"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientView } from "@/lib/tracker/client-view";
import type { getContributorView } from "@/lib/tracker/contributor-service";
import { ClientProjectViews } from "./ClientViews";
import { ContributorItemPanel, type PanelTarget } from "./ContributorItemPanel";
import { call, primary } from "./contributor-client";

export type ContributorPayload = Omit<Awaited<ReturnType<typeof getContributorView>>, "view"> & { view: ClientView };
type State = { kind: "loading" } | { kind: "ready"; data: ContributorPayload } | { kind: "unavailable" } | { kind: "busy" };

async function fetchState(token: string): Promise<State> {
  try {
    const r = await call(token, "", "GET");
    if (r.status === 429) return { kind: "busy" };
    if (!r.ok) return { kind: "unavailable" };
    return { kind: "ready", data: r.json as unknown as ContributorPayload };
  } catch {
    return { kind: "unavailable" };
  }
}

export function ContributorView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  // Called after a change so the page shows what is now true.
  const load = useCallback(async () => {
    setState(await fetchState(token));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void fetchState(token).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="es-client min-h-screen">
      <header className="border-b border-[var(--es-line)] bg-[var(--es-card)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-8">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--es-ink)]">Talkpush</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {state.kind === "loading" && (
          <div className="flex justify-center py-24" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--es-ink)] border-t-transparent" aria-hidden="true" />
            <span className="sr-only">Loading your project</span>
          </div>
        )}
        {state.kind === "unavailable" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">This link is not available</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">It may have expired or been replaced. Please ask your Talkpush contact for a new link.</p>
          </div>
        )}
        {state.kind === "busy" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Please try again in a few minutes</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">There have been a lot of requests from your connection.</p>
          </div>
        )}
        {state.kind === "ready" && <Ready token={token} data={state.data} reload={load} />}
      </main>
    </div>
  );
}

/**
 * The contributor's page: the same Summary, List, Board and Timeline a view-only client sees, plus Activity, and every
 * item opens in a panel where they can change it, comment on it and see its history.
 */
function Ready({ token, data, reload }: { token: string; data: ContributorPayload; reload: () => Promise<void> }) {
  const [target, setTarget] = useState<PanelTarget>(null);
  const [notice, setNotice] = useState("");
  const base = `/api/contribute/${encodeURIComponent(token)}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Hello {data.you.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--es-muted)]">
          Open any item in the List or Board to change it or leave a comment. Everyone with a link, and the Talkpush team, can see what changed in the Activity tab.
        </p>
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-[var(--es-line)] bg-[var(--es-card)] px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      <ClientProjectViews
        data={data.view}
        downloadUrl={`${base}/export`}
        activityUrl={`${base}/activity`}
        activityKey={`${data.comments.length}-${data.items.map((i) => i.updatedAt).sort().pop() ?? ""}`}
        onOpenItem={setTarget}
        toolbar={
          <button type="button" className={primary} onClick={() => setTarget("new")}>
            Add an item
          </button>
        }
      />

      <ContributorItemPanel
        token={token}
        data={data}
        target={target}
        onClose={() => setTarget(null)}
        reload={reload}
        onAdded={() => setNotice("Added. Talkpush will review it, and everyone can see it in Activity.")}
      />
    </div>
  );
}
