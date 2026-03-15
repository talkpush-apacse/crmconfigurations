export function LegendBar() {
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-muted border-b border-border text-[11px] text-muted-foreground shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
        Section Status:
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" /> Complete
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /> In progress
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full border-2 border-muted-foreground/40 bg-transparent shrink-0" /> Not started
      </span>
    </div>
  );
}
