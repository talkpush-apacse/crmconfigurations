import { headers } from "next/headers";
import { ClientProjectViews } from "@/components/tracker/ClientViews";
import { loadSharedClientView } from "@/lib/tracker/share-access";

// A private, per-viewer page: always rendered fresh on the server, never cached.
export const dynamic = "force-dynamic";

/**
 * The page a client opens from their private link. Read-only, no sign-in, no
 * staff chrome. Uses the executive-report palette (es-client) only.
 *
 * The link is checked and the summary is built here on the server, so the first
 * response already carries the status (an exec on a phone sees it straight away
 * instead of a spinner). It goes through the same door as /api/share/[token]:
 * same rate limits, same generic "not available" for any bad link, same data.
 */
export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadSharedClientView(token, await headers());

  return (
    <div className="es-client min-h-screen">
      <header className="border-b border-[var(--es-line)] bg-[var(--es-card)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-8">
          {/* Plain typeset name: the official logo lockup has not been supplied yet, and the brand rules forbid drawing one. */}
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--es-ink)]">Talkpush</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {result.status === "ok" && <ClientProjectViews data={result.data} downloadUrl={`/api/share/${encodeURIComponent(token)}/export`} />}

        {result.status === "unavailable" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">This link is not available</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">It may have expired or been replaced. Please ask your Talkpush contact for a new link.</p>
          </div>
        )}

        {result.status === "busy" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Please try again in a few minutes</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">This page has had a lot of requests from your connection.</p>
          </div>
        )}
      </main>
    </div>
  );
}
