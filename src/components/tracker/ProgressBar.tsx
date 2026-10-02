export function ProgressBar({ done, total, className = "" }: { done: number; total: number; className?: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${done} of ${total} items done`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-status-completed" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {total === 0 ? "No items yet" : `${done} of ${total} done (${percent}%)`}
      </p>
    </div>
  );
}
