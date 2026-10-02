"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ExternalLink, Plus, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityView } from "@/components/tracker/ActivityView";
import { MetricsView } from "@/components/tracker/MetricsView";
import { ShareDialog } from "@/components/tracker/ShareDialog";
import { SummaryView } from "@/components/tracker/SummaryView";
import { TimelineView } from "@/components/tracker/TimelineView";
import { BoardView } from "@/components/tracker/BoardView";
import { HealthBadge, ProjectStatusBadge } from "@/components/tracker/badges";
import { ItemSheet } from "@/components/tracker/ItemSheet";
import { ItemsList } from "@/components/tracker/ItemsList";
import { ErrorBlock, LoadingBlock } from "@/components/tracker/PageHeader";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { ItemDTO, ProjectDetailDTO } from "@/lib/tracker/client-types";
import type { ItemStatus } from "@/lib/tracker/constants";
import { formatDate, plural } from "@/lib/tracker/format";

export default function ProjectPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading project" />}>
      <ProjectWorkspace />
    </Suspense>
  );
}

const VIEWS = ["summary", "list", "board", "timeline", "metrics", "activity"] as const;
type View = (typeof VIEWS)[number];

function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("view");
  const view: View = (VIEWS as readonly string[]).includes(requested ?? "") ? (requested as View) : "summary";
  const setView = (next: string) => router.replace(`${pathname}?view=${next}`, { scroll: false });
  const { data: detail, error, reload: load } = useApiResource<ProjectDetailDTO>(`/api/tracker/projects/${id}`);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDTO | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const changeStatus = async (item: ItemDTO, status: ItemStatus, blockerReason?: string): Promise<string | null> => {
    try {
      await api(`/api/tracker/items/${item.id}`, {
        method: "PATCH",
        body: { status, ...(blockerReason !== undefined ? { blockerReason } : {}) },
      });
      load();
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  };

  const openItem = (item: ItemDTO) => {
    setEditingItem(item);
    setSheetOpen(true);
  };

  const reorder = async (itemIds: string[]): Promise<string | null> => {
    try {
      await api(`/api/tracker/projects/${id}/order`, { method: "PUT", body: { itemIds } });
      load();
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  };

  if (error && !detail) return <ErrorBlock message={error} onRetry={load} />;
  if (!detail) return <LoadingBlock label="Loading project" />;

  const { project, summary, items, phases, people, today, checklist } = detail;
  const health = summary.health;

  return (
    <>
      <Link href="/admin/tracker" className="mb-3 inline-flex min-h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Portfolio
      </Link>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Link href={`/admin/tracker/accounts/${project.accountId}`} className="inline-block py-1 hover:underline">
              {project.accountName}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{project.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <HealthBadge level={health.level} overridden={health.overridden} />
            <ProjectStatusBadge status={project.status} />
          </div>
          {health.overridden && health.overrideNote && <p className="mt-2 text-sm text-muted-foreground">Set by hand: {health.overrideNote}</p>}
          {health.reasons.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {health.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {project.objective && <p className="mt-3 max-w-2xl text-sm text-foreground">{project.objective}</p>}
          <p className="mt-3 text-sm tabular-nums text-muted-foreground">
            Start {formatDate(project.startDate)}. Target {formatDate(project.targetDate)}
            {project.rescheduleCount > 0 && project.originalTargetDate
              ? ` (first planned for ${formatDate(project.originalTargetDate)}, moved ${plural(project.rescheduleCount, "time")})`
              : ""}
            .{project.goLiveDate ? ` Go-live ${formatDate(project.goLiveDate)}.` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner: {project.owner?.name ?? "not set"}. Sponsor: {project.sponsor?.name ?? "not set"}.
          </p>
          {checklist && (
            <p className="mt-1 text-sm text-muted-foreground">
              CRM configuration: {checklist.completeCount} of {checklist.totalCount} sections complete.{" "}
              <Link href={`/admin/checklists/${checklist.id}`} className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
                Open checklist
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button
            onClick={() => {
              setEditingItem(null);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>
      </header>

      <section aria-label="Project items">
        <Tabs value={view} onValueChange={setView} className="gap-4">
          <TabsList aria-label="Project views" className="scrollbar-thin max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "summary" && <SummaryView projectId={project.id} refreshKey={project.updatedAt + items.length + summary.done + summary.open} />}
        {view === "list" && (
          <ItemsList
            items={items}
            phases={phases}
            people={people}
            today={today}
            onOpen={openItem}
            onStatusChange={changeStatus}
          />
        )}
        {view === "board" && (
          <BoardView items={items} people={people} today={today} onOpen={openItem} onStatusChange={changeStatus} onReorder={reorder} />
        )}
        {view === "timeline" && (
          <>
            {/* The timeline needs room. On a phone, show the same items as a list instead. */}
            <div className="md:hidden">
              <p className="mb-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">The timeline is best on a larger screen, so here are the same items as a list.</p>
              <ItemsList items={items} phases={phases} people={people} today={today} onOpen={openItem} onStatusChange={changeStatus} />
            </div>
            <div className="hidden md:block">
              <TimelineView
                items={items}
                phases={phases}
                project={{ startDate: project.startDate, targetDate: project.targetDate, goLiveDate: project.goLiveDate }}
                today={today}
                onOpen={openItem}
                onPhasesChanged={load}
              />
            </div>
          </>
        )}
        {view === "metrics" && <MetricsView projectId={project.id} today={today} />}
        {view === "activity" && <ActivityView projectId={project.id} today={today} refreshKey={project.updatedAt + items.length + summary.done} />}
      </section>

      <ItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projectId={project.id}
        item={editingItem}
        items={items}
        phases={phases}
        people={people}
        onSaved={() => void load()}
      />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} projectId={project.id} />
      <ProjectDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        project={project}
        people={people}
        onSaved={() => void load()}
        onArchived={() => router.push("/admin/tracker")}
      />
    </>
  );
}
