"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/tracker/Field";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { linkItem, type LinkKind } from "@/lib/companies/client";
import type { UnassignedGroup } from "@/lib/companies/unassigned";
import { plural } from "@/lib/tracker/format";

interface Row {
  id: string;
  title: string;
  detail: string;
  /** The typed client name looks like this company. */
  matches: boolean;
}

/** Add checklists or workflows that are not under any company yet to this one. */
export function LinkExistingDialog({
  open,
  onOpenChange,
  kind,
  company,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LinkKind;
  company: { id: string; name: string };
  onLinked: () => void;
}) {
  const [groups, setGroups] = useState<UnassignedGroup[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const noun = kind === "checklist" ? "checklist" : "workflow";

  useEffect(() => {
    // The dialog is mounted fresh each time it opens, so there is nothing to reset here.
    if (!open) return;
    let cancelled = false;
    api<{ groups: UnassignedGroup[] }>("/api/companies/unassigned")
      .then((r) => !cancelled && setGroups(r.groups))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups ?? []) {
      const matches = g.suggestion?.id === company.id;
      if (kind === "checklist") for (const c of g.checklists) out.push({ id: c.id, title: c.clientName, detail: "Checklist", matches });
      else for (const w of g.workflows) out.push({ id: w.id, title: w.workflowName, detail: `For ${w.clientName}`, matches });
    }
    return out.sort((a, b) => Number(b.matches) - Number(a.matches) || a.title.localeCompare(b.title));
  }, [groups, kind, company.id]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const failed: string[] = [];
    for (const id of picked) {
      try {
        await linkItem(kind, id, company.id);
      } catch {
        failed.push(id);
      }
    }
    setSaving(false);
    onLinked();
    if (failed.length === 0) {
      onOpenChange(false);
    } else {
      setPicked(new Set(failed));
      setError(`${plural(failed.length, noun)} could not be added. They are still selected; try again.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add an existing {noun}</DialogTitle>
            <DialogDescription>
              These {noun}s are not under a company yet. Pick the ones that belong to {company.name}. To take one from another company, use Move on that company&apos;s page.
            </DialogDescription>
          </DialogHeader>

          {groups === null && !error ? (
            <p className="py-6 text-center text-sm text-muted-foreground" role="status">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No {noun}s are waiting for a company.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Add ${r.title}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                    </span>
                    {r.matches && <span className="shrink-0 rounded-full bg-brand-sage/60 px-2 py-0.5 text-[11px] font-medium text-foreground">Name matches</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || picked.size === 0}>
              {saving ? "Adding..." : picked.size > 0 ? `Add ${picked.size} to ${company.name}` : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
