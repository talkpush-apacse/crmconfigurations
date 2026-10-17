"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, Plus, Settings, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityView } from "@/components/tracker/ActivityView";
import { MetricsView } from "@/components/tracker/MetricsView";
import { ShareDialog } from "@/components/tracker/ShareDialog";
import { SummaryView } from "@/components/tracker/SummaryView";
import { TimelineView } from "@/components/tracker/TimelineView";
import { BoardView } from "@/components/tracker/BoardView";
import { ProjectStatusBadge } from "@/components/tracker/badges";
import { AttentionBell, HealthInline, ProjectStrip } from "@/components/tracker/ProjectStrip";
import { ItemSheet } from "@/components/tracker/ItemSheet";
import { ItemsList } from "@/components/tracker/ItemsList";
import { ErrorBlock } from "@/components/tracker/PageHeader";
import { ProjectPageSkeleton } from "@/components/tracker/SummarySkeleton";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import { ExportMenu } from "@/components/tracker/ExportMenu";
import { PrintReport, type PrintView, type VisibleItems } from "@/components/tracker/print/PrintReport";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { READ_ONLY_MESSAGE } from "@/lib/roles";
import { useCurrentUser } from "@/lib/use-current-user";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { useDocumentTitle } from "@/lib/tracker/use-document-title";
import type { ItemDTO, ProjectDetailDTO } from "@/lib/tracker/client-types";
import type { ItemStatus } from "@/lib/tracker/constants";
import { plural } from "@/lib/tracker/format";
import { exportName } from "@/lib/tracker/print-layout";

export default function ProjectPage() {
  return (
    <Suspense fallback={<ProjectPageSkeleton />}>
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
  const { canEdit } = useCurrentUser();
  // Bumped by the bell's "Show in list" so the List tab starts over, filtered to the items that need attention.
  const [attentionKey, setAttentionKey] = useState(0);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  useDocumentTitle(detail?.project.title);
  const [printing, setPrinting] = useState<{ view: PrintView; visible: VisibleItems | null } | null>(null);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportError, setExportError] = useState("");
  // What the List and Board tabs are showing, so an export matches the screen. A ref: it changes with every filter click and needs no re-render.
  const visibleRef = useRef<VisibleItems | null>(null);
  const rememberVisible = useCallback((v: VisibleItems) => {
    visibleRef.current = v;
  }, []);
  const printDone = useCallback(() => setPrinting(null), []);
  const printFailed = useCallback((message: string) => {
    setExportError(message);
    setPrinting(null);
  }, []);

  const changeStatus = async (item: ItemDTO, status: ItemStatus, blockerReason?: string): Promise<string | null> => {
    if (!canEdit) return READ_ONLY_MESSAGE;
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

  const showAttentionInList = () => {
    setAttentionKey((k) => k + 1);
    setView("list");
  };

  const openItem = (item: ItemDTO) => {
    setEditingItem(item);
    setSheetOpen(true);
  };

  const duplicate = async () => {
    try {
      const copy = await api<{ id: string }>(`/api/tracker/projects/${id}/duplicate`, { method: "POST" });
      router.push(`/admin/tracker/projects/${copy.id}`);
    } catch (err) {
      setExportError(errorMessage(err));
    }
  };

  const markAllReviewed = async () => {
    try {
      await api(`/api/tracker/projects/${id}/review-all`, { method: "POST" });
      load();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const reorder = async (itemIds: string[]): Promise<string | null> => {
    if (!canEdit) return READ_ONLY_MESSAGE;
    try {
      await api(`/api/tracker/projects/${id}/order`, { method: "PUT", body: { itemIds } });
      load();
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  };

  const startPdf = () => {
    setExportError("");
    if (view !== "summary" && view !== "list" && view !== "board" && view !== "timeline") return;
    // Freeze what the tab shows at this moment; the report must not change if a filter is touched while it prepares.
    setPrinting({ view, visible: view === "list" || view === "board" ? visibleRef.current : null });
  };

  const downloadXlsx = async () => {
    if (!detail) return;
    setExportError("");
    setExportingXlsx(true);
    try {
      const shown = visibleRef.current?.items ?? detail.items;
      const res = await fetch(`/api/tracker/projects/${id}/export/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: shown.map((i) => i.id), filterLabel: visibleRef.current?.filterLabel ?? "" }),
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "The Excel file could not be made. Please try again.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportName({ account: detail.project.accountName, project: detail.project.title, view: "List", date: detail.today })}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "The Excel file could not be made. Please try again.");
    } finally {
      setExportingXlsx(false);
    }
  };

  /** The whole project as one Excel file: Summary, List, Board and Timeline. A plain GET, so read-only logins can use it. */
  const downloadWorkbook = async () => {
    if (!detail) return;
    setExportError("");
    setExportingXlsx(true);
    try {
      const res = await fetch(`/api/tracker/projects/${id}/export/workbook`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "The Excel file could not be made. Please try again.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exportName({ account: detail.project.accountName, project: detail.project.title, view: "Tracker", date: detail.today })}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "The Excel file could not be made. Please try again.");
    } finally {
      setExportingXlsx(false);
    }
  };

  if (error && !detail) return <ErrorBlock message={error} onRetry={load} />;
  if (!detail) return <ProjectPageSkeleton />;

  const { project, summary, items, phases, people, today } = detail;
  const health = summary.health;

  return (
    <>
      <header className="mb-3 flex flex-col gap-2">
        {/* Below md every action is a 44px touch target; desktop keeps the denser buttons. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 max-md:[&_button]:min-h-11">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/admin/tracker" className="inline-flex min-h-11 items-center hover:text-foreground hover:underline md:min-h-8">
              Portfolio
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/admin/companies/${project.accountId}`} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline md:min-h-8">
              {project.accountName}
            </Link>
            <span aria-hidden="true">/</span>
          </nav>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{project.title}</h1>
          <HealthInline health={health} objective={project.objective} />
          <ProjectStatusBadge status={project.status} />
          <span className="flex-1" />
          {(view === "summary" || view === "list" || view === "board" || view === "timeline") && (
            <ExportMenu view={view} busy={printing !== null || exportingXlsx} onPdf={startPdf} onXlsx={() => void downloadXlsx()} onWorkbook={() => void downloadWorkbook()} />
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" aria-label="Duplicate project" title="Duplicate project" className="text-muted-foreground max-md:size-11" onClick={() => setDuplicateOpen(true)}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={canEdit ? "Settings" : "Details"} title={canEdit ? "Settings" : "Details"} className="text-muted-foreground max-md:size-11" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <AttentionBell items={items} today={today} onOpenItem={openItem} onShowInList={showAttentionInList} />
          {canEdit && (
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => {
                setEditingItem(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          )}
        </div>
        <ProjectStrip detail={detail} />
      </header>

      {exportError && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {exportError}
        </p>
      )}

      <section aria-label="Project items">
        {items.some((i) => i.needsReview) && (
          <div role="status" className="mb-4 flex flex-col gap-2 rounded-lg border border-status-pending/50 bg-status-pending/15 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              {plural(items.filter((i) => i.needsReview).length, "item")} added by the client {items.filter((i) => i.needsReview).length === 1 ? "needs" : "need"} your review. The client can see them, but they do not count toward project health until you review them.
            </p>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={markAllReviewed}>
                Mark all reviewed
              </Button>
            )}
          </div>
        )}
        <Tabs value={view} onValueChange={setView} className="gap-4">
          {/* On a phone the six views wrap into two rows of three so none is cut off; from md up it is one row. */}
          <TabsList
            aria-label="Project views"
            className="scrollbar-thin grid h-auto w-full grid-cols-3 gap-1 group-data-[orientation=horizontal]/tabs:h-auto md:inline-flex md:w-fit md:max-w-full md:justify-start md:overflow-x-auto md:group-data-[orientation=horizontal]/tabs:h-9"
          >
            <TabsTrigger value="summary" className="min-h-11 md:min-h-0">Summary</TabsTrigger>
            <TabsTrigger value="list" className="min-h-11 md:min-h-0">List</TabsTrigger>
            <TabsTrigger value="board" className="min-h-11 md:min-h-0">Board</TabsTrigger>
            <TabsTrigger value="timeline" className="min-h-11 md:min-h-0">Timeline</TabsTrigger>
            <TabsTrigger value="metrics" className="min-h-11 md:min-h-0">Metrics</TabsTrigger>
            <TabsTrigger value="activity" className="min-h-11 md:min-h-0">Activity</TabsTrigger>
          </TabsList>

          {/* Each view is a real tab panel, so a screen reader hears which panel a tab opens. The panel is not a tab stop: every view has its own focusable controls. */}
          <TabsContent value="summary" tabIndex={-1}>
            <SummaryView projectId={project.id} refreshKey={project.updatedAt + items.length + summary.done + summary.open} />
          </TabsContent>
          <TabsContent value="list" tabIndex={-1}>
            <ItemsList
              key={attentionKey}
              items={items}
              phases={phases}
              people={people}
              today={today}
              onOpen={openItem}
              onStatusChange={changeStatus}
              onVisibleChange={rememberVisible}
              initialStatus={attentionKey > 0 ? "attention" : undefined}
            />
          </TabsContent>
          <TabsContent value="board" tabIndex={-1}>
            <BoardView items={items} people={people} today={today} onOpen={openItem} onStatusChange={changeStatus} onReorder={reorder} onVisibleChange={rememberVisible} />
          </TabsContent>
          <TabsContent value="timeline" tabIndex={-1}>
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
          </TabsContent>
          <TabsContent value="metrics" tabIndex={-1}>
            <MetricsView projectId={project.id} today={today} />
          </TabsContent>
          <TabsContent value="activity" tabIndex={-1}>
            <ActivityView projectId={project.id} today={today} refreshKey={project.updatedAt + items.length + summary.done} />
          </TabsContent>
        </Tabs>
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
      {printing && <PrintReport view={printing.view} detail={detail} visible={printing.visible} onDone={printDone} onError={printFailed} />}
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} projectId={project.id} contacts={people.filter((p) => p.side === "client")} onContactsChanged={load} />
      <ConfirmDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        title="Duplicate this project?"
        description="Makes a new project with the same phases, items and success metrics. Items start as Not started, with no dates, owners or Jira links. Remarks, activity, files, readings, client links and the checklist link are not copied."
        confirmLabel="Duplicate project"
        onConfirm={duplicate}
      />
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
