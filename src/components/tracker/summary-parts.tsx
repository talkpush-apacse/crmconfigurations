import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small building blocks for the exec summary. They read only the --es-* colour
 * variables, so the staff and client palettes cannot be mixed (globals.css).
 */

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--es-muted)]">{children}</p>;
}

export function KpiCard({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "alert" | "good" }) {
  return (
    <div className="rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--es-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-[29px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--es-ink)] md:text-[40px]",
          tone === "alert" && "text-[var(--es-red)]"
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-[var(--es-muted)]">{note}</p>}
    </div>
  );
}

/** One or two sentences under every chart, with a 4px accent bar on the left. */
export function InsightNote({ children, accent = "blue" }: { children: React.ReactNode; accent?: "blue" | "green" | "orange" | "pink" }) {
  const bar = { blue: "var(--es-blue)", green: "var(--es-green)", orange: "var(--es-orange)", pink: "var(--es-pink)" }[accent];
  // impeccable-disable-next-line side-tab: the Talkpush brand guidelines require a 4px accent bar on the left of every insight note
  const barStyle = { borderLeft: `4px solid ${bar}` };
  return (
    <p className="mt-3 rounded-r-[4px] bg-[var(--es-bg)] px-4 py-3 text-sm text-[var(--es-ink)]" style={barStyle}>
      {children}
    </p>
  );
}

export interface PhaseStep {
  name: string;
  total: number;
  done: number;
  open: number;
}

/** Sequential phase cards joined by chevrons. Finished = green, the one in progress = blue, the rest outlined. */
export function PhaseFlow({ phases }: { phases: PhaseStep[] }) {
  const currentIndex = phases.findIndex((p) => p.open > 0);
  return (
    <ol className="flex snap-x gap-0 overflow-x-auto pb-1" aria-label="Project phases">
      {phases.map((p, i) => {
        const complete = p.total > 0 && p.open === 0;
        const current = i === currentIndex;
        const state = complete ? "Complete" : current ? "In progress" : p.total === 0 ? "No items" : "Upcoming";
        return (
          <li key={p.name} className="flex shrink-0 snap-start items-stretch">
            <div
              className={cn(
                "w-32 rounded-[10px] border p-3 md:w-36",
                complete ? "border-transparent bg-[var(--es-green-soft)]" : current ? "border-transparent bg-[var(--es-blue-soft)]" : "border-[var(--es-line)] bg-[var(--es-card)]"
              )}
            >
              <p className="text-sm font-semibold leading-tight text-[var(--es-ink)]">{p.name}</p>
              <p className="mt-1 text-xs tabular-nums text-[var(--es-muted)]">{p.total === 0 ? "No items" : `${p.done} of ${p.total} done`}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--es-ink)]">{state}</p>
            </div>
            {i < phases.length - 1 && <ChevronRight className="my-auto h-4 w-4 shrink-0 text-[var(--es-muted)]" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function SectionTitle({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="mb-3 text-lg font-semibold tracking-[-0.02em] text-[var(--es-ink)]">
      {children}
    </h2>
  );
}
