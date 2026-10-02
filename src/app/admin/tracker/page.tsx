"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthBadge } from "@/components/tracker/badges";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { ProgressBar } from "@/components/tracker/ProgressBar";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { AccountDTO, PortfolioProjectDTO } from "@/lib/tracker/client-types";
import { formatDate, formatShortDate, plural } from "@/lib/tracker/format";

const SEARCH_THRESHOLD = 8;
const HEALTH_ORDER: Record<string, number> = { off_track: 0, at_risk: 1, on_track: 2 };

type StatusFilter = "current" | "completed" | "all";

function targetNote(p: PortfolioProjectDTO): string | null {
  const days = p.summary.daysToTarget;
  if (days === null || p.status === "completed") return null;
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `in ${plural(days, "day")}`;
}

export default function PortfolioPage() {
  const router = useRouter();
  const projectsRes = useApiResource<{ today: string; projects: PortfolioProjectDTO[] }>("/api/tracker/projects");
  const accountsRes = useApiResource<{ accounts: AccountDTO[] }>("/api/tracker/accounts");
  const projects = projectsRes.data?.projects ?? null;
  const today = projectsRes.data?.today ?? "";
  const accounts = accountsRes.data?.accounts ?? [];
  const error = projectsRes.error || accountsRes.error;
  const load = () => {
    projectsRes.reload();
    accountsRes.reload();
  };
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("current");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => (statusFilter === "all" ? true : statusFilter === "completed" ? p.status === "completed" : p.status !== "completed"))
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.accountName.toLowerCase().includes(q))
      .sort((a, b) => {
        const h = (HEALTH_ORDER[a.summary.health.level] ?? 3) - (HEALTH_ORDER[b.summary.health.level] ?? 3);
        if (h !== 0) return h;
        return (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999");
      });
  }, [projects, query, statusFilter]);

  const newProjectButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      New project
    </Button>
  );

  return (
    <>
      <PageHeader title="Project Tracker" description="Every client implementation, worst health first." actions={newProjectButton} />

      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : projects === null ? (
        <LoadingBlock label="Loading projects" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={accounts.length === 0 ? "Create an account for your client first, then add their project." : "Create the first project to start tracking open items."}
          action={
            accounts.length === 0 ? (
              <Button onClick={() => router.push("/admin/tracker/accounts")}>Go to accounts</Button>
            ) : (
              newProjectButton
            )
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {projects.length >= SEARCH_THRESHOLD && (
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label="Search projects"
                  placeholder="Search by project or account"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger aria-label="Filter by status" className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Planned and active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">All projects</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No projects match. Change the filter or search.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary hover:bg-secondary">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Project</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Health</TableHead>
                      <TableHead className="w-48 text-xs font-semibold uppercase tracking-wider">Progress</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Next milestone</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Target</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => {
                      const note = targetNote(p);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="py-3">
                            <Link href={`/admin/tracker/projects/${p.id}`} className="inline-block py-1 font-medium underline-offset-4 hover:underline">
                              {p.title}
                            </Link>
                            <span className="block text-xs text-muted-foreground">{p.accountName}</span>
                          </TableCell>
                          <TableCell>
                            <HealthBadge level={p.summary.health.level} overridden={p.summary.health.overridden} />
                            {p.summary.health.reasons[0] && !p.summary.health.overridden && (
                              <span className="mt-1 block max-w-[16rem] text-xs text-muted-foreground">{p.summary.health.reasons[0]}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ProgressBar done={p.summary.done} total={p.summary.total} />
                          </TableCell>
                          <TableCell>
                            {p.summary.nextMilestone ? (
                              <>
                                <span className="block text-sm">{p.summary.nextMilestone.title}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">{formatShortDate(p.summary.nextMilestone.dueDate, today)}</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">None set</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatDate(p.targetDate)}
                            {note && <span className="block text-xs text-muted-foreground">{note}</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.summary.open}
                            {p.summary.overdue > 0 && <span className="block text-xs text-destructive">{p.summary.overdue} overdue</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Phone cards */}
              <ul className="space-y-3 md:hidden">
                {visible.map((p) => {
                  const note = targetNote(p);
                  return (
                    <li key={p.id} className="rounded-lg border border-border bg-card p-4">
                      <Link href={`/admin/tracker/projects/${p.id}`} className="block min-h-11 font-medium">
                        {p.title}
                        <span className="block text-xs font-normal text-muted-foreground">{p.accountName}</span>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <HealthBadge level={p.summary.health.level} overridden={p.summary.health.overridden} />
                        {p.summary.overdue > 0 && <span className="text-xs text-destructive">{p.summary.overdue} overdue</span>}
                      </div>
                      <ProgressBar className="mt-3" done={p.summary.done} total={p.summary.total} />
                      <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                        Target {formatDate(p.targetDate)}
                        {note ? `, ${note}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      <ProjectDialog open={creating} onOpenChange={setCreating} accounts={accounts} onSaved={(p) => router.push(`/admin/tracker/projects/${p.id}`)} />
    </>
  );
}
