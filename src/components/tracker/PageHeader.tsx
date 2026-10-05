export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* Below md, header actions are 44px touch targets; desktop keeps the denser buttons. */}
      {actions && <div className="flex flex-wrap gap-2 max-md:[&_a]:min-h-11 max-md:[&_button]:min-h-11">{actions}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-lg font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-medium text-foreground underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}
