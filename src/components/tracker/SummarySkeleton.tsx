import { cn } from "@/lib/utils";

/**
 * Loading placeholders that match the layout they stand in for, so the page does not
 * jump when the data arrives. Server-safe (no hooks). Each one is a single status
 * region with a screen-reader label; the grey shapes are hidden from assistive tech.
 */

function Bar({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-[var(--es-line)] motion-safe:animate-pulse", className)} />;
}

/** Headline, KPI row and phase row of the executive summary. */
export function SummarySkeleton({ context, label = "Loading summary" }: { context: "staff" | "client"; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={`es-${context} rounded-xl border border-[var(--es-line)] bg-[var(--es-bg)]`}>
      <div className="es-gradient h-1.5 rounded-t-xl" aria-hidden="true" />
      <div className="p-5 md:p-8">
        <div className="max-w-3xl space-y-3">
          <Bar className="h-3 w-40" />
          <Bar className="h-6 w-full md:h-8" />
          <Bar className="h-6 w-2/3 md:h-8" />
          <Bar className="h-4 w-1/2" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4">
              <Bar className="h-3 w-20" />
              <Bar className="mt-3 h-8 w-16 md:h-10" />
              <Bar className="mt-3 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Bar className="mb-3 h-5 w-44" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-full rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-3 md:w-36 md:shrink-0">
                <Bar className="h-4 w-20" />
                <Bar className="mt-2 h-3 w-16" />
                <Bar className="mt-3 h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** The project page before its data arrives: back link, title, health pills, view tabs, then the summary. */
export function ProjectPageSkeleton({ label = "Loading project" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      <div aria-hidden="true" className="es-staff space-y-6">
        <div className="space-y-3">
          <Bar className="h-4 w-20" />
          <Bar className="h-3 w-32" />
          <Bar className="h-8 w-2/3 max-w-md" />
          <div className="flex gap-2">
            <Bar className="h-6 w-20 rounded-full" />
            <Bar className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <Bar className="h-11 w-full md:h-9 md:w-96" />
        <SummarySkeletonBody />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function SummarySkeletonBody() {
  return (
    <div className="rounded-xl border border-[var(--es-line)] bg-[var(--es-bg)] p-5 md:p-8">
      <div className="max-w-3xl space-y-3">
        <Bar className="h-6 w-full md:h-8" />
        <Bar className="h-6 w-2/3 md:h-8" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4">
            <Bar className="h-3 w-20" />
            <Bar className="mt-3 h-8 w-16 md:h-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
