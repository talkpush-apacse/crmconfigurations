"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Flag, History, Hand } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ItemDTO, ProjectDetailDTO } from "@/lib/tracker/client-types";
import { HEALTH_LABELS, type HealthLevel } from "@/lib/tracker/constants";
import { describeDue } from "@/lib/tracker/dates";
import { formatDate, formatShortDate, plural } from "@/lib/tracker/format";
import { attentionIsUrgent, attentionItems, type AttentionKind } from "@/lib/tracker/attention";
import { dateBar, statusCounts } from "@/lib/tracker/project-strip";
import { cn } from "@/lib/utils";

/** Hover and keyboard-focus tooltip on any element. Several lines are fine. */
function Tip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs whitespace-pre-line text-left leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

const HEALTH_DOT: Record<HealthLevel, string> = {
  on_track: "bg-status-completed",
  at_risk: "bg-status-pending",
  off_track: "bg-status-declined",
};

/** Health word with a dot, and the hand icon when someone set it by hand. The long note lives in the tooltip. */
export function HealthInline({ health, objective }: { health: ProjectDetailDTO["summary"]["health"]; objective: string | null }) {
  const level = (health.level in HEALTH_LABELS ? health.level : "on_track") as HealthLevel;
  const lines: string[] = [];
  if (health.overridden) lines.push(health.overrideNote ? `Set by hand: ${health.overrideNote}` : "Set by hand.");
  lines.push(...health.reasons);
  if (objective) lines.push(`Goal: ${objective}`);
  const note = lines.join("\n");
  return (
    <TooltipProvider>
      <Tip content={note || `${HEALTH_LABELS[level]}. Nothing is flagged.`}>
        <button
          type="button"
          className="inline-flex min-h-8 items-center gap-1.5 rounded px-1 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
          aria-label={`${HEALTH_LABELS[level]}${health.overridden ? ", set by hand" : ""}. ${note}`}
        >
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", HEALTH_DOT[level])} />
          {HEALTH_LABELS[level]}
          {health.overridden && <Hand className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        </button>
      </Tip>
    </TooltipProvider>
  );
}

const SEGMENTS = [
  { key: "done", label: "done", cls: "bg-foreground" },
  { key: "in_progress", label: "in progress", cls: "bg-muted-foreground" },
  { key: "waiting_on_client", label: "waiting", cls: "bg-status-pending" },
  { key: "blocked", label: "blocked", cls: "bg-status-declined" },
  { key: "not_started", label: "not started", cls: "bg-border" },
] as const;

interface StripProps {
  detail: ProjectDetailDTO;
}

/** The one-line strip under the title: progress, dates, how often the target moved, owner and the checklist link. */
export function ProjectStrip({ detail }: StripProps) {
  const { project, items, today, checklist } = detail;
  const counts = useMemo(() => statusCounts(items), [items]);
  const total = SEGMENTS.reduce((n, s) => n + counts[s.key], 0);
  const bar = dateBar({ start: project.startDate, target: project.targetDate, today, finished: project.status === "completed" });

  const progressTip = total
    ? `${SEGMENTS.filter((s) => counts[s.key] > 0)
        .map((s) => `${counts[s.key]} ${s.label}`)
        .join(", ")}.`
    : "No items yet.";
  const dateTip = [
    `Start ${formatDate(project.startDate)}`,
    `Target ${formatDate(project.targetDate)}`,
    project.goLiveDate ? `Go-live ${formatDate(project.goLiveDate)}` : null,
    `Today ${formatDate(today)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const movedTip = project.originalTargetDate ? `First planned for ${formatDate(project.originalTargetDate)}. Moved ${plural(project.rescheduleCount, "time")}.` : `Target moved ${plural(project.rescheduleCount, "time")}.`;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Project progress">
        <Tip content={progressTip}>
          <div className="flex items-center gap-2" tabIndex={0} aria-label={`${counts.done} of ${total} done. ${progressTip}`}>
            <span className="text-xl font-bold tabular-nums tracking-tight">
              {counts.done}
              <span className="text-muted-foreground">/{total}</span>
            </span>
            <div className="flex h-3 w-32 gap-0.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
              {SEGMENTS.map((s) => (counts[s.key] > 0 ? <span key={s.key} className={cn("block h-full", s.cls)} style={{ width: `${(counts[s.key] / total) * 100}%` }} /> : null))}
            </div>
          </div>
        </Tip>

        {project.targetDate && (
          <Tip content={dateTip}>
            <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground" tabIndex={0} aria-label={`Target ${formatDate(project.targetDate)}${bar && bar.overDays > 0 ? `, ${bar.overDays} days past target` : ""}`}>
              {bar && (
                <div className="relative h-2 w-24 rounded-full bg-border" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground" style={{ width: `${bar.fillPct}%` }} />
                  {bar.overPct > 0 && <span className="absolute inset-y-0 rounded-r-full bg-status-declined" style={{ left: `${bar.targetPct}%`, width: `${bar.overPct}%` }} />}
                  <span className="absolute -top-1 h-4 w-0.5 rounded-sm bg-foreground" style={{ left: `calc(${bar.tickPct}% - 1px)` }} />
                </div>
              )}
              <span className="inline-flex items-center gap-1">
                <Flag className="h-3 w-3" aria-hidden="true" />
                {formatShortDate(project.targetDate, today)}
              </span>
              {bar && bar.overDays > 0 && <span className="rounded-full bg-status-declined/20 px-2 py-0.5 text-xs font-bold text-foreground">+{bar.overDays}d</span>}
            </div>
          </Tip>
        )}

        {project.rescheduleCount > 0 && (
          <Tip content={movedTip}>
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground" tabIndex={0} aria-label={`Moved ${plural(project.rescheduleCount, "time")}. ${movedTip}`}>
              <History className="h-3 w-3" aria-hidden="true" />
              {project.rescheduleCount}×
            </span>
          </Tip>
        )}

        {(project.owner || project.sponsor) && (
          <span className="text-xs text-muted-foreground">
            {project.owner && <>Owner {project.owner.name}</>}
            {project.owner && project.sponsor && ", "}
            {project.sponsor && <>Sponsor {project.sponsor.name}</>}
          </span>
        )}

        {checklist && (
          <Link href={`/admin/checklists/${checklist.id}`} className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
            CRM checklist {checklist.completeCount}/{checklist.totalCount}
          </Link>
        )}
      </div>
    </TooltipProvider>
  );
}

const KIND_DOT: Record<AttentionKind, string> = {
  blocked: "bg-status-declined",
  overdue: "bg-status-declined",
  waiting: "bg-status-pending",
  due_soon: "bg-status-pending",
};

function kindTag(kind: AttentionKind, item: ItemDTO, lateDays: number, today: string): string {
  if (kind === "blocked") return "Blocked";
  if (kind === "overdue") return `${lateDays}d overdue`;
  if (kind === "waiting") return "Waiting on client";
  return describeDue(item.dueDate, today) ?? "Due soon";
}

interface BellProps {
  items: ItemDTO[];
  today: string;
  onOpenItem: (item: ItemDTO) => void;
  /** Take the person to the List tab showing only these items. */
  onShowInList: () => void;
}

/** The bell beside Share: a count badge (red when anything is overdue or blocked, else amber) and the list behind it. */
export function AttentionBell({ items, today, onOpenItem, onShowInList }: BellProps) {
  const list = useMemo(() => attentionItems(items, today), [items, today]);
  const urgent = attentionIsUrgent(list);
  const label = list.length === 0 ? "Nothing needs attention" : `${plural(list.length, "item")} ${list.length === 1 ? "needs" : "need"} attention`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/70 max-md:size-11"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {list.length > 0 && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-0 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold text-foreground ring-2 ring-background",
                urgent ? "bg-status-declined text-white" : "bg-status-pending"
              )}
            >
              {list.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</DropdownMenuLabel>
        {list.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Nothing is blocked, overdue, waiting on the client or due in the next 7 days.</p>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto">
              {list.map(({ item, kind, lateDays }) => (
                <DropdownMenuItem key={item.id} onSelect={() => onOpenItem(item)} className="cursor-pointer gap-2">
                  <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", KIND_DOT[kind])} />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  <span className={cn("flex shrink-0 items-center gap-1 text-xs", kind === "overdue" || kind === "blocked" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {(kind === "overdue" || kind === "blocked") && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
                    {kindTag(kind, item, lateDays, today)}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onShowInList} className="cursor-pointer justify-center font-semibold">
              Show in list
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
