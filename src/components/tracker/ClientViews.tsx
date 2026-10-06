"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClientView } from "@/lib/tracker/client-view";
import { formatDate } from "@/lib/tracker/format";
import { ClientBoard, ClientItemsList } from "./ClientItemViews";
import { ClientActivityFeed } from "./ClientActivityFeed";
import { ClientDownloadButton } from "./ClientDownloadButton";
import { ExecSummary } from "./ExecSummary";
import { ReadOnlyTimeline } from "./TimelineView";
import { Eyebrow } from "./summary-parts";

/**
 * What a client sees: Summary, List, Board and Timeline of one project, read-only.
 * Used by the public share page and by the staff "View as client" preview, so the
 * preview is the same page. Colours come from the es-client palette only.
 */

const VIEWS = ["summary", "list", "board", "timeline", "activity"] as const;
type View = (typeof VIEWS)[number];

interface ViewsProps {
  data: ClientView;
  banner?: React.ReactNode;
  downloadUrl?: string;
  /** Where the activity trail comes from. Without it there is no Activity tab (the staff preview). */
  activityUrl?: string;
  /** On a contributor link: open an item to edit it and comment. Without it, items are read-only. */
  onOpenItem?: (itemId: string) => void;
  /** Extra buttons next to the download button (the contributor's "Add item"). */
  toolbar?: React.ReactNode;
  /** Changes when something was saved, so the Activity tab loads fresh. */
  activityKey?: string;
}

export function ClientProjectViews(props: ViewsProps) {
  return (
    <Suspense fallback={null}>
      <Views {...props} />
    </Suspense>
  );
}

function Views({ data, banner, downloadUrl, activityUrl, onOpenItem, toolbar, activityKey }: ViewsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("view");
  const view: View = (VIEWS as readonly string[]).includes(requested ?? "") && (requested !== "activity" || activityUrl) ? (requested as View) : "summary";
  const setView = (next: string) => router.replace(`${pathname}?view=${next}`, { scroll: false });
  const { plan, project } = data;

  return (
    <div className="es-client bg-transparent text-[var(--es-ink)]">
      {banner && <div className="mb-4">{banner}</div>}
      {(downloadUrl || toolbar) && (
        <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>{toolbar}</div>
          {downloadUrl && <ClientDownloadButton url={downloadUrl} />}
        </div>
      )}
      <Tabs value={view} onValueChange={setView} className="gap-4">
        <TabsList aria-label="Project views" className="scrollbar-thin max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary" className="min-h-9">Summary</TabsTrigger>
          <TabsTrigger value="list" className="min-h-9">List</TabsTrigger>
          <TabsTrigger value="board" className="min-h-9">Board</TabsTrigger>
          <TabsTrigger value="timeline" className="min-h-9">Timeline</TabsTrigger>
          {activityUrl && (
            <TabsTrigger value="activity" className="min-h-9">
              Activity
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary">
          <ExecSummary data={data} context="client" />
        </TabsContent>

        {(["list", "board", "timeline"] as const).map((v) => (
          <TabsContent key={v} value={v}>
            <header className="mb-5 max-w-3xl">
              <Eyebrow>Project status, {project.account}</Eyebrow>
              <h1 className="mt-2 text-[19px] font-bold leading-[1.2] tracking-[-0.03em] md:text-[29px] md:leading-[1.15]">{project.title}</h1>
              <p className="mt-2 text-sm text-[var(--es-muted)]">{data.headline}</p>
            </header>

            {v === "list" && <ClientItemsList items={plan.items} phases={plan.phases} today={data.asOf} onOpen={onOpenItem} />}
            {v === "board" && <ClientBoard items={plan.items} today={data.asOf} onOpen={onOpenItem} />}
            {v === "timeline" && (
              <>
                {/* The timeline needs room. On a phone, show the same items as a list instead. */}
                <div className="md:hidden">
                  <p className="mb-3 rounded-lg border border-[var(--es-line)] bg-[var(--es-card)] px-4 py-3 text-sm text-[var(--es-muted)]">The timeline is best on a larger screen, so here are the same items as a list.</p>
                  <ClientItemsList items={plan.items} phases={plan.phases} today={data.asOf} onOpen={onOpenItem} />
                </div>
                <div className="hidden md:block">
                  <ReadOnlyTimeline
                    items={plan.items}
                    phases={plan.phases}
                    project={{ startDate: project.startDate, targetDate: project.targetDate, goLiveDate: project.goLiveDate }}
                    today={data.asOf}
                  />
                </div>
              </>
            )}

            <footer className="mt-10 flex flex-col gap-1 border-t border-[var(--es-line)] pt-4 text-[11px] uppercase tracking-[0.06em] text-[var(--es-muted)] sm:flex-row sm:justify-between">
              <span>Talkpush, Business Operations</span>
              <span>As of {formatDate(data.asOf)}, Confidential</span>
            </footer>
          </TabsContent>
        ))}

        {activityUrl && (
          <TabsContent value="activity">
            <header className="mb-5 max-w-3xl">
              <Eyebrow>Project status, {project.account}</Eyebrow>
              <h1 className="mt-2 text-[19px] font-bold leading-[1.2] tracking-[-0.03em] md:text-[29px] md:leading-[1.15]">Activity</h1>
              <p className="mt-2 text-sm text-[var(--es-muted)]">Who changed what, and when, on the items in this project. Team-only items and notes are not shown.</p>
            </header>
            <ClientActivityFeed key={activityKey} url={activityUrl} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
