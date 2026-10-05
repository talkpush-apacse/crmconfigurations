import { Eye, Lock, UserRound } from "lucide-react";
import { DEFAULT_PHASES, PLAN_AUDIENCE_LABELS, type PlanAudience } from "@/lib/tracker/constants";
import { cn } from "@/lib/utils";

const base =
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground";

const STYLE: Record<PlanAudience, string> = {
  internal: "border-border bg-muted",
  shared: "border-status-in-progress/40 bg-status-in-progress/15",
  client: "border-status-pending/50 bg-status-pending/20",
};

const ICON = { internal: Lock, shared: Eye, client: UserRound } as const;

/** Who an item is for. Written out and iconed, never colour alone. */
export function AudienceBadge({ audience, className }: { audience: string; className?: string }) {
  const key = (audience in PLAN_AUDIENCE_LABELS ? audience : "shared") as PlanAudience;
  const Icon = ICON[key];
  return (
    <span className={cn(base, STYLE[key], className)}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {PLAN_AUDIENCE_LABELS[key]}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground", className)}>{children}</span>;
}

export interface PlanGroupItem {
  phaseName: string;
  groupName: string;
}

export interface PlanPhaseBlock<T> {
  phase: string;
  groups: { name: string; items: T[] }[];
}

/** Items in plan order, grouped by phase (in tracker phase order) and then by group. */
export function groupPlanItems<T extends PlanGroupItem>(items: readonly T[]): PlanPhaseBlock<T>[] {
  const order = (name: string) => {
    const i = (DEFAULT_PHASES as readonly string[]).indexOf(name);
    return i === -1 ? DEFAULT_PHASES.length : i;
  };
  const phases = new Map<string, Map<string, T[]>>();
  for (const item of items) {
    const groups = phases.get(item.phaseName) ?? new Map<string, T[]>();
    const list = groups.get(item.groupName) ?? [];
    list.push(item);
    groups.set(item.groupName, list);
    phases.set(item.phaseName, groups);
  }
  return [...phases.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([phase, groups]) => ({ phase, groups: [...groups.entries()].map(([name, list]) => ({ name, items: list })) }));
}
