"use client";

import { useState } from "react";
import { Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonDialog } from "@/components/tracker/PersonDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import type { PersonDTO } from "@/lib/tracker/client-types";

export default function TeamPage() {
  const { data, error, reload: load } = useApiResource<{ people: PersonDTO[] }>("/api/tracker/people");
  const people = data?.people ?? null;
  const [actionError, setActionError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PersonDTO | null>(null);

  const addMe = async () => {
    setActionError("");
    try {
      await api("/api/tracker/people/me", { method: "POST" });
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Team"
        description="Talkpush staff who can own items on any project."
        actions={
          <>
            <Button variant="outline" onClick={addMe}>
              <UserPlus className="h-4 w-4" />
              Add me
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Add team member
            </Button>
          </>
        }
      />
      {actionError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : people === null ? (
        <LoadingBlock label="Loading team" />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members yet"
          description="Add yourself first so you can own items, then add your colleagues."
          action={
            <Button onClick={addMe}>
              <UserPlus className="h-4 w-4" />
              Add me
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider sm:table-cell">Email</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider md:table-cell">Job title</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="py-3 font-medium">{p.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{p.email ?? ""}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.title ?? ""}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="max-md:h-11" onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PersonDialog open={adding} onOpenChange={setAdding} accountId={null} onSaved={() => void load()} />
      <PersonDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} accountId={null} person={editing} onSaved={() => void load()} />
    </>
  );
}
