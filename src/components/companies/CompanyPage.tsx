"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, ClipboardList, FolderKanban, GitBranch, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AccountDialog } from "@/components/tracker/AccountDialog";
import { HealthBadge, ProjectStatusBadge } from "@/components/tracker/badges";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import NewWorkflowModal from "@/components/workflow/modals/NewWorkflowModal";
import { statusStyle } from "@/components/workflow/status-style";
import { toast, WorkflowToaster } from "@/components/workflow/ui/toast";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { useDocumentTitle } from "@/lib/tracker/use-document-title";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import { formatDate, plural } from "@/lib/tracker/format";
import type { PortfolioProjectDTO } from "@/lib/tracker/client-types";
import type { getCompany, CompanyChecklistItem, CompanyWorkflowItem } from "@/lib/companies/overview";
import { describeAttention, attentionTotal } from "@/lib/companies/gallery";
import { archiveChecklist, archiveWorkflow, linkItem, openItemHref, type LinkKind } from "@/lib/companies/client";
import { deleteChecklist } from "@/lib/checklist-admin-actions";
import { ChecklistRowMenu } from "./ChecklistRowMenu";
import { LinkExistingDialog } from "./LinkExistingDialog";
import { MoveToCompanyDialog } from "./MoveToCompanyDialog";

type CompanyDetail = Awaited<ReturnType<typeof getCompany>>;

/** One company: its checklists, workflows and project trackers (several of each), and what needs attention. */
export function CompanyPage({ id }: { id: string }) {
  const router = useRouter();
  const { canEdit } = useCurrentUser();
  const detail = useApiResource<CompanyDetail>(`/api/companies/${id}`);
  const trackers = useApiResource<{ projects: PortfolioProjectDTO[] }>(`/api/tracker/projects?accountId=${id}`);
  const company = detail.data?.company ?? null;
  useDocumentTitle(company?.name);

  const [editing, setEditing] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState(false);
  const [newTracker, setNewTracker] = useState(false);
  const [linking, setLinking] = useState<LinkKind | null>(null);
  const [moving, setMoving] = useState<{ kind: LinkKind; id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ kind: LinkKind; id: string; name: string } | null>(null);
  const [archiving, setArchiving] = useState<{ kind: LinkKind; id: string; name: string } | null>(null);
  // A deleted checklist is hidden at once and only really deleted after 5 seconds, so Undo can bring it back.
  const [pendingDelete, setPendingDelete] = useState<{ item: CompanyChecklistItem; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    return () => {
      if (pendingDelete) clearTimeout(pendingDelete.timer);
    };
  }, [pendingDelete]);

  const reload = () => {
    detail.reload();
    trackers.reload();
  };

  const startDelete = (item: CompanyChecklistItem) => {
    const timer = setTimeout(async () => {
      try {
        await deleteChecklist(item.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete checklist");
      } finally {
        setPendingDelete(null);
        reload();
      }
    }, 5000);
    setPendingDelete({ item, timer });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setPendingDelete(null);
  };

  if (detail.error) return <ErrorBlock message={detail.error} onRetry={reload} />;
  if (!detail.data || !company) return <LoadingBlock label="Loading account" />;

  const { contacts } = detail.data;
  const workflows = detail.data.workflows.filter((w) => !w.archivedAt);
  const archivedWorkflows = detail.data.workflows.filter((w) => w.archivedAt);
  const checklists = detail.data.checklists.filter((c) => !c.archivedAt && c.id !== pendingDelete?.item.id);
  const archivedChecklists = detail.data.checklists.filter((c) => c.archivedAt);
  const projects = trackers.data?.projects ?? [];
  const needAttention = workflows.filter((w) => attentionTotal(w.attention) > 0);

  return (
    <>
      <Link href="/admin/home" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-8">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Accounts
      </Link>
      <PageHeader
        title={company.name}
        description={[company.companyName && company.geo ? `${company.companyName} · ${company.geo}` : "", company.notes ?? ""].filter(Boolean).join(" — ") || undefined}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/admin/tracker/accounts/${company.id}`}>
                <Users className="h-4 w-4" aria-hidden="true" />
                {plural(contacts, "contact")}
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )}
          </>
        }
      />

      {pendingDelete && (
        <div role="status" className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
            <p className="text-sm text-orange-700">
              <strong>{pendingDelete.item.clientName}</strong>&apos;s checklist will be deleted in 5 seconds.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={undoDelete} className="min-h-11 shrink-0 md:min-h-0">
            Undo
          </Button>
        </div>
      )}

      {needAttention.length > 0 && (
        <section aria-labelledby="attention-heading" className="mb-8 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h2 id="attention-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-900">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Needs your attention
          </h2>
          <ul className="divide-y divide-sky-200">
            {needAttention.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm text-sky-950">
                  <span className="font-medium">{w.workflowName}</span>: {describeAttention(w.attention)}
                </span>
                <Link href={openItemHref("workflow", w.id)} className="min-h-11 shrink-0 text-sm font-medium text-sky-900 underline underline-offset-4 md:min-h-0">
                  Open workflow
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section
        icon={ClipboardList}
        title="Config checklists"
        count={checklists.length}
        what="checklist"
        canEdit={canEdit}
        onNew={() => router.push(`/admin/new?account=${company.id}`)}
        onLink={() => setLinking("checklist")}
        emptyHint="Collect the configuration details this client needs for their Talkpush CRM."
      >
        {checklists.map((c) => (
          <Row
            key={c.id}
            href={openItemHref("checklist", c.id)}
            title={c.clientName}
            meta={<ChecklistProgress item={c} />}
            updated={c.updatedAt}
            menu={
              <ChecklistRowMenu
                item={c}
                accountId={company.id}
                canEdit={canEdit}
                onChanged={reload}
                onMove={() => setMoving({ kind: "checklist", id: c.id, name: c.clientName })}
                onRemove={() => setRemoving({ kind: "checklist", id: c.id, name: c.clientName })}
                onArchive={() => setArchiving({ kind: "checklist", id: c.id, name: c.clientName })}
                onDelete={() => startDelete(c)}
              />
            }
          />
        ))}
      </Section>

      <ArchivedList
        what="checklist"
        canEdit={canEdit}
        items={archivedChecklists.map((c) => ({ id: c.id, title: c.clientName, archivedAt: c.archivedAt as string, href: openItemHref("checklist", c.id) }))}
        onRestore={async (id) => {
          await archiveChecklist(id, false);
          reload();
        }}
      />

      <Section
        icon={GitBranch}
        title="Workflows"
        count={workflows.length}
        what="workflow"
        canEdit={canEdit}
        onNew={() => setNewWorkflow(true)}
        onLink={() => setLinking("workflow")}
        emptyHint="Map this client's hiring process, version it and share it for review."
      >
        {workflows.map((w) => (
          <Row
            key={w.id}
            href={openItemHref("workflow", w.id)}
            title={w.workflowName}
            meta={<WorkflowMeta item={w} />}
            updated={w.updatedAt}
            menu={canEdit ? <ItemMenu name={w.workflowName} onMove={() => setMoving({ kind: "workflow", id: w.id, name: w.workflowName })} onRemove={() => setRemoving({ kind: "workflow", id: w.id, name: w.workflowName })} onArchive={() => setArchiving({ kind: "workflow", id: w.id, name: w.workflowName })} archiveLabel="Archive workflow" /> : undefined}
          />
        ))}
      </Section>

      <ArchivedList
        what="workflow"
        canEdit={canEdit}
        items={archivedWorkflows.map((w) => ({ id: w.id, title: w.workflowName, archivedAt: w.archivedAt as string, href: openItemHref("workflow", w.id) }))}
        onRestore={async (id) => {
          await archiveWorkflow(id, false);
          reload();
        }}
      />

      <Section
        icon={FolderKanban}
        title="Project trackers"
        count={projects.length}
        what="project tracker"
        canEdit={canEdit}
        onNew={() => setNewTracker(true)}
        emptyHint="Follow this client's implementation: open items, owners, dates and success metrics."
        loading={trackers.data === null && !trackers.error}
        error={trackers.error}
        onRetry={trackers.reload}
      >
        {projects.map((p) => (
          <Row
            key={p.id}
            href={`/admin/tracker/projects/${p.id}`}
            title={p.title}
            meta={
              <span className="flex flex-wrap items-center gap-2">
                <HealthBadge level={p.summary.health.level} overridden={p.summary.health.overridden} />
                <ProjectStatusBadge status={p.status} />
                <span className="text-xs text-muted-foreground">Target {formatDate(p.targetDate)}</span>
              </span>
            }
          />
        ))}
      </Section>

      <AccountDialog open={editing} onOpenChange={setEditing} account={company} onSaved={() => reload()} />
      <NewWorkflowModal open={newWorkflow} onOpenChange={setNewWorkflow} account={{ id: company.id, name: company.name }} />
      <ProjectDialog open={newTracker} onOpenChange={setNewTracker} accounts={[company]} defaultAccountId={company.id} onSaved={(p) => router.push(`/admin/tracker/projects/${p.id}`)} />
      {linking && <LinkExistingDialog open onOpenChange={(o) => !o && setLinking(null)} kind={linking} company={{ id: company.id, name: company.name }} onLinked={reload} />}
      {moving && (
        <MoveToCompanyDialog open onOpenChange={(o) => !o && setMoving(null)} kind={moving.kind} itemId={moving.id} itemName={moving.name} currentAccountId={company.id} onMoved={reload} />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Take “${removing?.name ?? ""}” out of ${company.name}?`}
        description="Nothing is deleted and nothing changes for the client. It moves to “Needs an account” so you can file it under another one."
        confirmLabel="Take out"
        onConfirm={async () => {
          if (removing) await linkItem(removing.kind, removing.id, null);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive “${archiving?.name ?? ""}”?`}
        description={
          archiving?.kind === "workflow"
            ? "It moves out of your lists. Nothing is deleted, its share and review links keep working, and you can restore it any time from “Show archived workflows”."
            : "It moves out of your lists and its reminder emails stop. Nothing is deleted, the client's links keep working, and you can restore it any time from “Show archived checklists”."
        }
        confirmLabel={archiving?.kind === "workflow" ? "Archive workflow" : "Archive checklist"}
        onConfirm={async () => {
          if (archiving?.kind === "workflow") await archiveWorkflow(archiving.id, true);
          else if (archiving) await archiveChecklist(archiving.id, true);
          reload();
        }}
      />
      <WorkflowToaster />
    </>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  what,
  canEdit,
  onNew,
  onLink,
  emptyHint,
  loading,
  error,
  onRetry,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  what: string;
  canEdit: boolean;
  onNew: () => void;
  onLink?: () => void;
  emptyHint: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  const id = `section-${what.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          {title}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
        </h2>
        {canEdit && (
          <div className="flex gap-2 max-md:[&_button]:min-h-11">
            {onLink && (
              <Button variant="ghost" size="sm" onClick={onLink}>
                Add existing
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New {what}
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <ErrorBlock message={error} onRetry={onRetry} />
      ) : loading ? (
        <LoadingBlock label={`Loading ${title.toLowerCase()}`} />
      ) : count === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">No {what} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{children}</ul>
      )}
    </section>
  );
}

function Row({ href, title, meta, updated, menu }: { href: string; title: string; meta: React.ReactNode; updated?: string; menu?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link href={href} className="inline-flex min-h-11 items-center font-medium text-foreground underline-offset-4 hover:underline md:min-h-0">
          <span className="break-words">{title}</span>
        </Link>
        <div className="mt-0.5 text-sm text-muted-foreground">{meta}</div>
      </div>
      {updated && <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Updated {formatDistanceToNow(updated, { addSuffix: true })}</span>}
      {menu}
    </li>
  );
}

function ItemMenu({ name, onMove, onRemove, onArchive, archiveLabel = "Archive checklist" }: { name: string; onMove: () => void; onRemove: () => void; onArchive?: () => void; archiveLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:min-h-8 md:min-w-8" aria-label={`Actions for ${name}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="min-h-11 cursor-pointer md:min-h-0" onSelect={onMove}>
          Move to another account
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 cursor-pointer md:min-h-0" onSelect={onRemove}>
          Take out of this account
        </DropdownMenuItem>
        {onArchive && (
          <DropdownMenuItem className="min-h-11 cursor-pointer md:min-h-0" onSelect={onArchive}>
            <Archive className="h-4 w-4" aria-hidden="true" />
            {archiveLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChecklistProgress({ item }: { item: CompanyChecklistItem }) {
  const s = item.completionSummary;
  if (!s || s.totalCount === 0) return <span>No sections yet</span>;
  if (s.status === "complete") return <span>Complete</span>;
  if (s.status === "in-progress") return <span>In progress: {s.completeCount} of {s.totalCount} sections done</span>;
  return <span>Not started</span>;
}

function WorkflowMeta({ item }: { item: CompanyWorkflowItem }) {
  const st = statusStyle(item.status);
  const waiting = describeAttention(item.attention);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
      {item.currentVersion > 0 && <span className="text-xs">v{item.currentVersion}</span>}
      {waiting && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">{waiting}</span>}
    </span>
  );
}

/** "Show archived checklists (n)": the archived ones of one kind, each with a Restore button. */
function ArchivedList({
  what,
  canEdit,
  items,
  onRestore,
}: {
  what: "checklist" | "workflow";
  canEdit: boolean;
  items: { id: string; title: string; archivedAt: string; href: string }[];
  onRestore: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="-mt-5 mb-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:min-h-8"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        {open ? "Hide" : "Show"} archived {what}s ({items.length})
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
      {open && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-muted/40">
          {items.map((item) => (
            <Row
              key={item.id}
              href={item.href}
              title={item.title}
              meta={<span>Archived {formatDistanceToNow(item.archivedAt, { addSuffix: true })}</span>}
              menu={
                canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0 md:min-h-8"
                    onClick={async () => {
                      setError(null);
                      try {
                        await onRestore(item.id);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : `Couldn't restore the ${what}. Please try again.`);
                      }
                    }}
                  >
                    <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                    Restore
                  </Button>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
