"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardList, FolderKanban, GitBranch, MessageSquare, MoreHorizontal, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AccountDialog } from "@/components/tracker/AccountDialog";
import { HealthBadge, ProjectStatusBadge } from "@/components/tracker/badges";
import { ConfirmDialog } from "@/components/tracker/ConfirmDialog";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import NewWorkflowModal from "@/components/workflow/modals/NewWorkflowModal";
import { statusStyle } from "@/components/workflow/status-style";
import { WorkflowToaster } from "@/components/workflow/ui/toast";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { useDocumentTitle } from "@/lib/tracker/use-document-title";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import { formatDate, plural } from "@/lib/tracker/format";
import type { PortfolioProjectDTO } from "@/lib/tracker/client-types";
import type { getCompany, CompanyChecklistItem, CompanyWorkflowItem } from "@/lib/companies/overview";
import { describeAttention, attentionTotal } from "@/lib/companies/gallery";
import { linkItem, openItemHref, type LinkKind } from "@/lib/companies/client";
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

  const reload = () => {
    detail.reload();
    trackers.reload();
  };

  if (detail.error) return <ErrorBlock message={detail.error} onRetry={reload} />;
  if (!detail.data || !company) return <LoadingBlock label="Loading account" />;

  const { checklists, workflows, contacts } = detail.data;
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
            menu={canEdit ? <ItemMenu name={c.clientName} onMove={() => setMoving({ kind: "checklist", id: c.id, name: c.clientName })} onRemove={() => setRemoving({ kind: "checklist", id: c.id, name: c.clientName })} /> : undefined}
          />
        ))}
      </Section>

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
            menu={canEdit ? <ItemMenu name={w.workflowName} onMove={() => setMoving({ kind: "workflow", id: w.id, name: w.workflowName })} onRemove={() => setRemoving({ kind: "workflow", id: w.id, name: w.workflowName })} /> : undefined}
          />
        ))}
      </Section>

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

function ItemMenu({ name, onMove, onRemove }: { name: string; onMove: () => void; onRemove: () => void }) {
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
