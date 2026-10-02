import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import {
  HEALTH_LABELS,
  ITEM_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  type HealthLevel,
  type ItemStatus,
  type ProjectStatus,
} from "@/lib/tracker/constants";
import { cn } from "@/lib/utils";

/**
 * Status and health pills. Colour comes from the existing status tokens
 * (sage = done, lavender = in progress, amber = waiting, red = blocked) but the
 * label is always written out, so colour is never the only cue.
 */

const base =
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground";

const ITEM_STYLE: Record<ItemStatus, string> = {
  not_started: "border-border bg-muted",
  in_progress: "border-status-in-progress/40 bg-status-in-progress/20",
  waiting_on_client: "border-status-pending/50 bg-status-pending/20",
  blocked: "border-status-declined/40 bg-status-declined/10",
  done: "border-status-completed/50 bg-status-completed/25",
  dropped: "border-border bg-muted text-muted-foreground line-through",
};

const ITEM_DOT: Record<ItemStatus, string> = {
  not_started: "bg-muted-foreground/50",
  in_progress: "bg-status-in-progress",
  waiting_on_client: "bg-status-pending",
  blocked: "bg-status-declined",
  done: "bg-status-completed",
  dropped: "bg-muted-foreground/40",
};

export function ItemStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status in ITEM_STATUS_LABELS ? status : "not_started") as ItemStatus;
  return (
    <span className={cn(base, ITEM_STYLE[key], className)}>
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", ITEM_DOT[key])} />
      {ITEM_STATUS_LABELS[key]}
    </span>
  );
}

const HEALTH_STYLE: Record<HealthLevel, string> = {
  on_track: "border-status-completed/50 bg-status-completed/25",
  at_risk: "border-status-pending/50 bg-status-pending/25",
  off_track: "border-status-declined/40 bg-status-declined/10",
};

const HEALTH_ICON = {
  on_track: CheckCircle2,
  at_risk: AlertTriangle,
  off_track: CircleAlert,
} as const;

export function HealthBadge({
  level,
  overridden = false,
  className,
}: {
  level: string;
  overridden?: boolean;
  className?: string;
}) {
  const key = (level in HEALTH_LABELS ? level : "on_track") as HealthLevel;
  const Icon = HEALTH_ICON[key];
  return (
    <span className={cn(base, HEALTH_STYLE[key], className)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {HEALTH_LABELS[key]}
      {overridden && <span className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground">set by hand</span>}
    </span>
  );
}

export function ProjectStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;
  return <span className={cn(base, "border-border bg-secondary", className)}>{label}</span>;
}
