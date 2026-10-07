"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ClipboardList, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { FormError } from "@/components/tracker/Field";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { AccountDTO } from "@/lib/tracker/client-types";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { plural } from "@/lib/tracker/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { linkItem, openItemHref } from "@/lib/companies/client";
import { unassignedTotal, type UnassignedGroup } from "@/lib/companies/unassigned";

const NEW_COMPANY = "__new";

interface Response {
  groups: UnassignedGroup[];
  accounts: { id: string; name: string }[];
}

/**
 * The "needs a company" holding area. Items are grouped by the client name typed on them, so everything for one client
 * is filed in one step: under an existing company, or under a new one made from that name.
 */
export function UnassignedList() {
  const { data, error, reload } = useApiResource<Response>("/api/companies/unassigned");

  return (
    <>
      <Link href="/admin/home" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-8">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Companies
      </Link>
      <PageHeader
        title="Needs a company"
        description="These checklists and workflows are not filed under a company yet. Pick a company for each client name below and everything under that name moves together."
      />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : data === null ? (
        <LoadingBlock label="Loading" />
      ) : data.groups.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Everything is filed"
          description="Every checklist and workflow belongs to a company."
          action={
            <Button asChild>
              <Link href="/admin/home">Back to companies</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {plural(unassignedTotal(data.groups), "item")} under {plural(data.groups.length, "client name")}.
          </p>
          <ul className="space-y-4">
            {data.groups.map((g) => (
              <li key={g.key}>
                <GroupCard group={g} accounts={data.accounts} onFiled={reload} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function GroupCard({ group, accounts, onFiled }: { group: UnassignedGroup; accounts: { id: string; name: string }[]; onFiled: () => void }) {
  const { canEdit } = useCurrentUser();
  const [target, setTarget] = useState(group.suggestion?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = group.checklists.length + group.workflows.length;

  const file = async () => {
    setBusy(true);
    setError("");
    try {
      let accountId = target;
      if (target === NEW_COMPANY) {
        const created = await api<AccountDTO>("/api/tracker/accounts", { method: "POST", body: { name: group.clientName } });
        accountId = created.id;
      }
      const failed: string[] = [];
      for (const c of group.checklists) await linkItem("checklist", c.id, accountId).catch(() => failed.push(c.clientName));
      for (const w of group.workflows) await linkItem("workflow", w.id, accountId).catch(() => failed.push(w.workflowName));
      if (failed.length > 0) setError(`Could not file: ${failed.join(", ")}. The rest were filed.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onFiled();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{group.clientName}</h2>
        <span className="text-sm text-muted-foreground">{plural(total, "item")}</span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {group.checklists.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Link href={openItemHref("checklist", c.id)} className="min-w-0 truncate underline-offset-4 hover:underline">
              {c.clientName}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">checklist</span>
          </li>
        ))}
        {group.workflows.map((w) => (
          <li key={w.id} className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Link href={openItemHref("workflow", w.id)} className="min-w-0 truncate underline-offset-4 hover:underline">
              {w.workflowName}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">workflow</span>
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-11 w-full sm:w-72 md:h-9" aria-label={`Company for ${group.clientName}`}>
              <SelectValue placeholder="Choose a company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW_COMPANY}>New company “{group.clientName}”</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {group.suggestion?.id === a.id ? " (name matches)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={file} disabled={busy || !target} className="max-md:min-h-11">
            {busy ? "Filing..." : `File ${plural(total, "item")}`}
          </Button>
          {group.suggestion && target === group.suggestion.id && <span className="text-xs text-muted-foreground">Suggested because the name matches. Change it if that is wrong.</span>}
        </div>
      )}
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </div>
  );
}
