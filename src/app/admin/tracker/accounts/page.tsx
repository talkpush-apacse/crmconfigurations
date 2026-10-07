"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountDialog } from "@/components/tracker/AccountDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { AccountDTO } from "@/lib/tracker/client-types";
import { plural } from "@/lib/tracker/format";

export default function AccountsPage() {
  const { data, error, reload: load } = useApiResource<{ accounts: AccountDTO[] }>("/api/tracker/accounts");
  const accounts = data?.accounts ?? null;
  const { canEdit } = useCurrentUser();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Client companies. Each can have many projects and its own contacts."
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
        <ErrorBlock message={error} onRetry={load} />
      ) : accounts === null ? (
        <LoadingBlock label="Loading accounts" />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Add the first client company, then create its project."
          action={
            canEdit ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New account
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Account</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Projects</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider sm:table-cell">Contacts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="py-3">
                    <Link href={`/admin/tracker/accounts/${a.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                      {a.name}
                    </Link>
                    {a.companyName && a.geo && <span className="block text-xs text-muted-foreground">{a.companyName} · {a.geo}</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{plural(a.projectCount ?? 0, "project")}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{plural(a.peopleCount ?? 0, "contact")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AccountDialog open={creating} onOpenChange={setCreating} onSaved={() => void load()} />
    </>
  );
}
