import { SummarySkeleton } from "@/components/tracker/SummarySkeleton";

/** Shown only while the server is still checking the link and building the summary. */
export default function SharedProjectLoading() {
  return (
    <div className="es-client min-h-screen">
      <header className="border-b border-[var(--es-line)] bg-[var(--es-card)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-8">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--es-ink)]">Talkpush</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <SummarySkeleton context="client" label="Loading project status" />
      </main>
    </div>
  );
}
