"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, ClipboardList, FolderKanban, GitBranch, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountDialog } from "@/components/tracker/AccountDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { useCurrentUser } from "@/lib/use-current-user";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import {
  attentionTotal,
  describeAttention,
  filterCompanies,
  SORT_LABELS,
  sortCompanies,
  type CompanyCardData,
  type GallerySort,
} from "@/lib/companies/gallery";
import { plural } from "@/lib/tracker/format";

interface GalleryResponse {
  companies: CompanyCardData[];
  unassigned: { checklists: number; workflows: number };
}

/** The home page: every company as a card. Open one to see its checklists, workflows and project trackers. */
export function CompanyGallery() {
  const router = useRouter();
  const { canEdit } = useCurrentUser();
  const { data, error, reload } = useApiResource<GalleryResponse>("/api/companies");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<GallerySort>("recent");
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => sortCompanies(filterCompanies(data?.companies ?? [], query), sort), [data, query, sort]);
  const loose = (data?.unassigned.checklists ?? 0) + (data?.unassigned.workflows ?? 0);

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every client in one place. Open a company to see its checklists, workflows and project trackers."
        actions={
          canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New account
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : data === null ? (
        <LoadingBlock label="Loading companies" />
      ) : (
        <>
          {data.companies.length > 0 && (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-sm sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search companies"
                  aria-label="Search companies"
                  className="h-11 pl-9 md:h-9"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as GallerySort)}>
                <SelectTrigger aria-label="Sort companies" className="h-11 w-full sm:w-52 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as GallerySort[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SORT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
                {query ? `${shown.length} of ${plural(data.companies.length, "company", "companies")}` : plural(data.companies.length, "company", "companies")}
              </p>
            </div>
          )}

          {loose > 0 && (
            <Link
              href="/admin/companies/unassigned"
              className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-brand-amber bg-brand-amber/10 p-4 outline-none transition-colors hover:bg-brand-amber/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Needs a company ({loose})</span>
                <span className="block text-sm text-muted-foreground">
                  {[
                    data.unassigned.checklists ? plural(data.unassigned.checklists, "checklist") : "",
                    data.unassigned.workflows ? plural(data.unassigned.workflows, "workflow") : "",
                  ]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                  {loose === 1 ? "is" : "are"} not filed under a company yet.
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-foreground underline underline-offset-4">Sort them out</span>
            </Link>
          )}

          {data.companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description={loose > 0 ? "Create the first company, then file the checklists and workflows above under it." : "Add the first client company, then create its checklist, workflow or project tracker."}
              action={
                canEdit ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" />
                    New account
                  </Button>
                ) : undefined
              }
            />
          ) : shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No company matches “{query}”.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => (
                <li key={c.id}>
                  <CompanyCard company={c} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AccountDialog open={creating} onOpenChange={setCreating} onSaved={(a) => router.push(`/admin/companies/${a.id}`)} />
    </>
  );
}

function CompanyCard({ company: c }: { company: CompanyCardData }) {
  const waiting = attentionTotal(c.attention);
  const empty = c.checklistCount + c.workflowCount + c.projectCount === 0;
  return (
    <Link
      href={`/admin/companies/${c.id}`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 break-words text-base font-semibold tracking-tight text-foreground">{c.name}</h2>
        {waiting > 0 && (
          <span
            title={describeAttention(c.attention)}
            className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800"
          >
            {waiting} need{waiting === 1 ? "s" : ""} attention
          </span>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">Nothing set up yet. Open it to add a checklist, workflow or tracker.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="What this company has">
          <Count icon={ClipboardList} n={c.checklistCount} one="checklist" many="checklists" />
          <Count icon={GitBranch} n={c.workflowCount} one="workflow" many="workflows" />
          <Count icon={FolderKanban} n={c.projectCount} one="tracker" many="trackers" />
        </ul>
      )}
      <p className="mt-auto text-xs text-muted-foreground">Active {formatDistanceToNow(c.lastActivityAt, { addSuffix: true })}</p>
    </Link>
  );
}

function Count({ icon: Icon, n, one, many }: { icon: React.ComponentType<{ className?: string }>; n: number; one: string; many: string }) {
  return (
    <li className={n === 0 ? "flex items-center gap-1.5 text-muted-foreground/70" : "flex items-center gap-1.5 text-foreground"}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="tabular-nums">{n}</span>
      <span className="text-muted-foreground">{n === 1 ? one : many}</span>
    </li>
  );
}
