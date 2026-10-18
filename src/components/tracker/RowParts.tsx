import { AlertTriangle } from "lucide-react";
import { ITEM_STATUS_LABELS, PERSON_SIDE_LABELS, type ItemStatus, type PersonSide } from "@/lib/tracker/constants";
import { dueKind } from "@/lib/tracker/row-display";
import { initials } from "@/lib/tracker/row-display";
import { overdueDays } from "@/lib/tracker/dates";
import { formatShortDate } from "@/lib/tracker/format";
import { cn } from "@/lib/utils";

/** Waiting and blocked also get a word; the other statuses are told apart by their icon alone. */
const STATUS_WORD: Partial<Record<ItemStatus, string>> = { waiting_on_client: "Waiting", blocked: "Blocked" };

const ICON_COLOUR: Record<ItemStatus, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-foreground",
  waiting_on_client: "text-foreground",
  blocked: "text-foreground",
  done: "text-muted-foreground",
  dropped: "text-muted-foreground",
};

function statusKey(status: string): ItemStatus {
  return (status in ITEM_STATUS_LABELS ? status : "not_started") as ItemStatus;
}

/** One 18px icon per status: empty ring, half ring, tick, amber clock, red bar, slashed ring. */
export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const key = statusKey(status);
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className={cn("h-[18px] w-[18px] shrink-0", ICON_COLOUR[key], className)}>
      {key === "not_started" && <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {key === "in_progress" && (
        <>
          <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 4.8a4.2 4.2 0 0 1 0 8.4z" fill="currentColor" />
        </>
      )}
      {key === "done" && (
        <>
          <circle cx="9" cy="9" r="7" fill="currentColor" />
          <path d="m5.9 9.2 2.1 2.1 4.2-4.4" fill="none" stroke="var(--background)" strokeWidth="1.6" />
        </>
      )}
      {key === "waiting_on_client" && (
        <>
          <circle cx="9" cy="9" r="7.5" fill="var(--status-pending)" />
          <path d="M9 5v4.2l2.7 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </>
      )}
      {key === "blocked" && (
        <>
          <circle cx="9" cy="9" r="7.5" fill="var(--status-declined)" />
          <path d="M5.8 9h6.4" fill="none" stroke="var(--background)" strokeWidth="1.8" />
        </>
      )}
      {key === "dropped" && (
        <>
          <circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 12.5l7-7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

/** Icon, plus the word for waiting and blocked. Used inside the status button and, read-only, on its own. */
export function StatusFace({ status, full }: { status: string; full?: boolean }) {
  const key = statusKey(status);
  // On a phone there is no hover tooltip, so a card spells every status out.
  const word = full ? ITEM_STATUS_LABELS[key] : STATUS_WORD[key];
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusIcon status={status} />
      {word && <span className="text-xs font-semibold text-foreground">{word}</span>}
    </span>
  );
}

/** Filled circle for Talkpush people, outlined for client (and vendor) people. The name sits beside it. */
export function OwnerChip({ name, side, muted }: { name: string | null; side: string | null; muted?: boolean }) {
  if (!name) return <span className="text-muted-foreground">Unassigned</span>;
  const sideLabel = PERSON_SIDE_LABELS[side as PersonSide] ?? side ?? "";
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2" title={sideLabel ? `${name}, ${sideLabel}` : name}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          side === "talkpush" ? "bg-foreground text-background" : "border-[1.5px] border-foreground text-foreground"
        )}
      >
        {initials(name)}
      </span>
      <span className={cn("truncate", muted && "text-muted-foreground")}>{name}</span>
      {sideLabel && <span className="sr-only">, {sideLabel}</span>}
    </span>
  );
}

/** The due date as a pill: amber within a week, red with an alert icon when late, quiet when finished. */
export function DuePill({ item, today }: { item: { status: string; dueDate: string | null }; today: string }) {
  const kind = dueKind(item, today);
  if (kind === "none") return <span className="text-muted-foreground">No due date</span>;
  const late = kind === "over" ? overdueDays(item.dueDate, today) : 0;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-sm tabular-nums",
        kind === "closed" && "px-0 text-muted-foreground",
        kind === "soon" && "bg-status-pending/40 font-semibold",
        kind === "over" && "bg-status-declined/15 font-semibold"
      )}
    >
      {kind === "over" && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      {formatShortDate(item.dueDate, today)}
      {late > 0 && (
        <span className="text-xs font-medium">
          <span aria-hidden="true">· {late}d late</span>
          <span className="sr-only">, {late} {late === 1 ? "day" : "days"} overdue</span>
        </span>
      )}
      {kind === "soon" && <span className="sr-only">, due within 7 days</span>}
    </span>
  );
}
