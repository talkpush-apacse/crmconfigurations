"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FolderKanban, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountDialog } from "@/components/tracker/AccountDialog";
import { HealthBadge, ProjectStatusBadge } from "@/components/tracker/badges";
import { PersonDialog } from "@/components/tracker/PersonDialog";
import { ProjectDialog } from "@/components/tracker/ProjectDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { useDocumentTitle } from "@/lib/tracker/use-document-title";
import type { AccountDTO, PersonDTO, PortfolioProjectDTO } from "@/lib/tracker/client-types";
import { PERSON_SIDE_LABELS, type PersonSide } from "@/lib/tracker/constants";
import { formatDate } from "@/lib/tracker/format";

type AccountDetail = AccountDTO & { people: PersonDTO[] };

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const accountRes = useApiResource<AccountDetail>(`/api/tracker/accounts/${id}`);
  const projectsRes = useApiResource<{ projects: PortfolioProjectDTO[] }>(`/api/tracker/projects?accountId=${id}`);
  const account = accountRes.data;
  const projects = projectsRes.data?.projects ?? [];
  const error = accountRes.error || projectsRes.error;
  const load = () => {
    accountRes.reload();
    projectsRes.reload();
  };
  const [editingAccount, setEditingAccount] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonDTO | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  useDocumentTitle(account?.name);

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!account) return <LoadingBlock label="Loading account" />;

  return (
    <>
      <Link href="/admin/tracker/accounts" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm md:min-h-8 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        All accounts
      </Link>
      <PageHeader
        title={account.name}
        description={account.notes ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditingAccount(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button onClick={() => setCreatingProject(true)}>
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </>
        }
      />

      <section aria-labelledby="projects-heading" className="mb-8">
        <h2 id="projects-heading" className="mb-3 text-lg font-semibold tracking-tight">
          Projects
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects for this account"
            description="Create the first project to start tracking open items."
            action={
              <Button onClick={() => setCreatingProject(true)}>
                <Plus className="h-4 w-4" />
                New project
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Project</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Health</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider sm:table-cell">Status</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider sm:table-cell">Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-3">
                      <Link href={`/admin/tracker/projects/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <HealthBadge level={p.summary.health.level} overridden={p.summary.health.overridden} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <ProjectStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDate(p.targetDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="people-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="people-heading" className="text-lg font-semibold tracking-tight">
            Contacts
          </h2>
          <Button variant="outline" size="sm" className="max-md:h-11" onClick={() => setAddingPerson(true)}>
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
        </div>
        {account.people.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No contacts yet. Add client contacts and vendors so they can own items.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider sm:table-cell">Email</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {account.people.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="py-3">
                      <span className="font-medium">{p.name}</span>
                      {(p.title || p.organisation) && (
                        <span className="block text-xs text-muted-foreground">{[p.title, p.organisation].filter(Boolean).join(", ")}</span>
                      )}
                    </TableCell>
                    <TableCell>{PERSON_SIDE_LABELS[p.side as PersonSide] ?? p.side}</TableCell>
                    <TableCell className="hidden sm:table-cell">{p.email ?? ""}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="max-md:h-11" onClick={() => setEditingPerson(p)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AccountDialog open={editingAccount} onOpenChange={setEditingAccount} account={account} onSaved={() => void load()} />
      <PersonDialog open={addingPerson} onOpenChange={setAddingPerson} accountId={account.id} onSaved={() => void load()} />
      <PersonDialog
        open={!!editingPerson}
        onOpenChange={(o) => !o && setEditingPerson(null)}
        accountId={account.id}
        person={editingPerson}
        onSaved={() => void load()}
      />
      <ProjectDialog
        open={creatingProject}
        onOpenChange={setCreatingProject}
        accounts={[account]}
        defaultAccountId={account.id}
        onSaved={(p) => router.push(`/admin/tracker/projects/${p.id}`)}
      />
    </>
  );
}
