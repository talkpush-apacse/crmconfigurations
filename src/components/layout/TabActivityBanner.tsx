"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChecklistContext } from "@/lib/checklist-context";
import { activityTabForSlug } from "@/lib/edit-history/tab-keys";
import { useTabActivity } from "@/hooks/useTabActivity";
import { formatDistanceToNow } from "@/lib/workflow/dates";

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Tells you when someone else has been changing the tab you are on.
 *  - Strong (amber): they saved it since you opened the page, so your next save of this tab would be refused.
 *  - Soft: they changed it in the last 10 minutes; if you both edit, whoever saves second has to reload.
 * It only reports SAVED changes (it cannot know who merely has the tab open), and it never changes or blocks saving.
 */
export function TabActivityBanner({ activityUrl }: { activityUrl: string }) {
  const pathname = usePathname();
  const { data, hasPendingChanges } = useChecklistContext();
  // The tab is the last part of the address (/editor/<link>/users). Pages that are not a tab ask nothing.
  const slug = useMemo(() => {
    const last = (pathname ?? "").split("/").filter(Boolean).pop() ?? "";
    return data?.isCustom ? null : activityTabForSlug(last) ? last : null;
  }, [pathname, data?.isCustom]);
  const activity = useTabActivity(activityUrl, slug, data?.version ?? 0);

  if (!activity || (!activity.changedSinceYouOpened && activity.others.length === 0)) return null;

  const who = activity.others.length > 0 ? joinNames(activity.others.map((o) => o.name)) : "Someone";

  if (activity.changedSinceYouOpened) {
    return (
      <div role="status" aria-live="polite" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-brand-amber/40 bg-brand-amber-lightest px-4 py-3 text-sm text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{who}</span> changed this tab since you opened it. Reload to see their changes before you edit,
          or your next save of this tab may not go through.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 md:h-8"
          onClick={() => {
            if (hasPendingChanges && !window.confirm("You have changes that are not saved yet. Reload anyway and lose them?")) return;
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </div>
    );
  }

  const ago = formatDistanceToNow(activity.others[0].at, { addSuffix: true });
  return (
    <div role="status" aria-live="polite" className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground">
      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0">
        <span className="font-semibold">{who}</span> changed this tab {ago}. If you both edit it, whoever saves second will need to reload.
      </p>
    </div>
  );
}
