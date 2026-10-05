"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/tracker/constants";
import { plural } from "@/lib/tracker/format";
import { diffPlan } from "@/lib/tracker/plan-selection";
import type { ApplyPlanResult, ProjectPlanItemDTO } from "@/lib/tracker/plan-service";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { FormError } from "./Field";
import { LoadingBlock } from "./PageHeader";
import { AudienceBadge, groupPlanItems, Tag } from "./PlanParts";

interface ProjectPlanDTO {
  template: { id: string; name: string } | null;
  project: { id: string; title: string; startDate: string | null; hasOwner: boolean; archived: boolean } | null;
  items: ProjectPlanItemDTO[];
  projectHasPlanItems: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called after the plan was applied, so the project page can reload. */
  onApplied: () => void;
}

/** Tick what this client needs from the standard plan, then apply. Nothing is ever deleted: unticked items are archived. */
export function BuildPlanDialog({ open, onOpenChange, projectId, onApplied }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-3xl">
        {open && <BuildPlanBody projectId={projectId} onClose={() => onOpenChange(false)} onApplied={onApplied} />}
      </DialogContent>
    </Dialog>
  );
}

function BuildPlanBody({ projectId, onClose, onApplied }: { projectId: string; onClose: () => void; onApplied: () => void }) {
  const { data, error, reload } = useApiResource<ProjectPlanDTO>(`/api/tracker/projects/${projectId}/plan`);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [allowStarted, setAllowStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<ApplyPlanResult | null>(null);

  // Start from what the project already has, or from the plan's defaults for a project with no plan yet.
  useEffect(() => {
    if (!data || selected) return;
    const start = data.projectHasPlanItems ? data.items.filter((i) => i.inProject) : data.items.filter((i) => i.defaultIncluded);
    setSelected(new Set(start.map((i) => i.key)));
  }, [data, selected]);

  const blocks = useMemo(() => groupPlanItems(data?.items ?? []), [data]);

  const diff = useMemo(() => {
    if (!data || !selected) return null;
    const existing = data.items
      .filter((i) => i.itemId)
      .map((i) => ({ id: i.itemId as string, templateItemKey: i.key, archived: i.archivedInProject, status: i.status ?? "not_started", title: i.title }));
    return diffPlan(data.items.map((i) => i.key), selected, existing);
  }, [data, selected]);

  if (error && !data) {
    return (
      <div className="p-6">
        <DialogHeader>
          <DialogTitle>Build plan</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
        </DialogHeader>
        <Button className="mt-4" variant="outline" onClick={reload}>Try again</Button>
      </div>
    );
  }
  if (!data || !selected || !diff) {
    return (
      <div className="p-6">
        <DialogTitle className="sr-only">Build plan</DialogTitle>
        <LoadingBlock label="Loading the plan" />
      </div>
    );
  }

  if (!data.template) {
    return (
      <div className="p-6">
        <DialogHeader>
          <DialogTitle>Build plan</DialogTitle>
          <DialogDescription>The standard plan has not been set up yet.</DialogDescription>
        </DialogHeader>
        <Button asChild className="mt-4"><Link href="/admin/tracker/plan">Set up the standard plan</Link></Button>
      </div>
    );
  }

  const { project } = data;
  const total = data.items.length;
  const clientSees = data.items.filter((i) => selected.has(i.key) && i.audience !== "internal").length;
  const changes = diff.create.length + diff.restore.length + diff.archive.length;
  const needsConfirm = diff.startedToArchive.length > 0;

  const toggle = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const tick = (keys: string[]) => {
    const count = keys.filter((k) => selected.has(k)).length;
    return count === 0 ? false : count === keys.length ? true : ("indeterminate" as const);
  };

  const apply = async () => {
    setSaving(true);
    setFormError("");
    try {
      const done = await api<ApplyPlanResult>(`/api/tracker/projects/${projectId}/plan`, {
        method: "PUT",
        body: { selectedKeys: [...selected], allowStarted },
      });
      setResult(done);
      onApplied();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4 p-6">
        <DialogHeader>
          <DialogTitle>Plan updated</DialogTitle>
          <DialogDescription>
            {[
              result.created > 0 && `${plural(result.created, "item")} added`,
              result.restored > 0 && `${plural(result.restored, "item")} brought back`,
              result.archived > 0 && `${plural(result.archived, "item")} archived`,
              `${plural(result.kept, "item")} left as they were`,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </DialogDescription>
        </DialogHeader>
        {!result.hasStartDate && (
          <p className="rounded-md border border-status-pending/50 bg-status-pending/15 px-3 py-2 text-sm">
            This project has no start date, so the new items have no dates. Set a start date in Settings, then add dates to the items.
          </p>
        )}
        {result.droppedDependencies.length > 0 && (
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <p className="font-medium">Some links between items were left out:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {result.droppedDependencies.slice(0, 8).map((d) => (
                <li key={d}>{d}</li>
              ))}
              {result.droppedDependencies.length > 8 && <li>and {result.droppedDependencies.length - 8} more</li>}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="outline">
            <Link href={`/admin/tracker/projects/${projectId}/client-preview`}>Preview what the client sees</Link>
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border p-6 pb-4">
        <DialogHeader>
          <DialogTitle>Build plan for {project?.title}</DialogTitle>
          <DialogDescription>
            Tick what this client needs. {selected.size} of {total} selected; the client will see {clientSees} of them. Unticking archives an item and keeps its history.
          </DialogDescription>
        </DialogHeader>
        {project && !project.startDate && (
          <p className="mt-3 rounded-md border border-status-pending/50 bg-status-pending/15 px-3 py-2 text-sm">
            This project has no start date yet. Items will be added without dates. Set a start date in Settings first to get a ready-made timeline.
          </p>
        )}
        {project && !project.hasOwner && (
          <p className="mt-2 text-xs text-muted-foreground">No project owner is set, so Talkpush items will start unassigned.</p>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
        {blocks.map((block) => {
          const phaseKeys = block.groups.flatMap((g) => g.items.map((i) => i.key));
          return (
            <section key={block.phase} aria-labelledby={`build-phase-${block.phase}`}>
              <label className="flex min-h-8 items-center gap-2">
                <Checkbox checked={tick(phaseKeys)} onCheckedChange={(v) => toggle(phaseKeys, v === true)} aria-label={`Select all in ${block.phase}`} />
                <h3 id={`build-phase-${block.phase}`} className="text-base font-bold tracking-tight">
                  {block.phase}
                </h3>
                <span className="text-xs text-muted-foreground">{phaseKeys.filter((k) => selected.has(k)).length} of {phaseKeys.length}</span>
              </label>
              <div className="mt-2 space-y-3 pl-6">
                {block.groups.map((group) => {
                  const groupKeys = group.items.map((i) => i.key);
                  return (
                    <div key={group.name}>
                      <label className="flex min-h-8 items-center gap-2">
                        <Checkbox checked={tick(groupKeys)} onCheckedChange={(v) => toggle(groupKeys, v === true)} aria-label={`Select all in ${group.name}`} />
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.name}</span>
                      </label>
                      <ul className="mt-1 space-y-0.5 pl-6">
                        {group.items.map((item) => (
                          <li key={item.key}>
                            <label className="flex cursor-pointer flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-muted sm:flex-row sm:items-center sm:gap-3">
                              <span className="flex min-w-0 flex-1 items-start gap-2">
                                <Checkbox className="mt-0.5" checked={selected.has(item.key)} onCheckedChange={(v) => toggle([item.key], v === true)} />
                                <span className="text-sm text-foreground">{item.title}</span>
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5 pl-6 sm:pl-0">
                                <span className="text-xs text-muted-foreground">{item.timing}</span>
                                <AudienceBadge audience={item.audience} />
                                {!item.defaultIncluded && <Tag>Optional</Tag>}
                                {item.inProject && (
                                  <Tag>{item.status && item.status !== "not_started" ? `In project, ${ITEM_STATUS_LABELS[item.status as ItemStatus]?.toLowerCase() ?? item.status}` : "In project"}</Tag>
                                )}
                                {item.archivedInProject && <Tag>Removed earlier</Tag>}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-border p-6 pt-4">
        {needsConfirm && (
          <label className="flex items-start gap-2 rounded-md border border-status-pending/50 bg-status-pending/15 px-3 py-2 text-sm">
            <Checkbox className="mt-0.5" checked={allowStarted} onCheckedChange={(v) => setAllowStarted(v === true)} />
            <span>
              Work has already started on {diff.startedToArchive.slice(0, 3).map((i) => `"${i.title}"`).join(", ")}
              {diff.startedToArchive.length > 3 ? ` and ${diff.startedToArchive.length - 3} more` : ""}. Archive{diff.startedToArchive.length === 1 ? " it" : " them"} anyway.
            </span>
          </label>
        )}
        <FormError message={formError} />
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm text-muted-foreground" role="status">
            {changes === 0
              ? "No changes to apply."
              : [
                  diff.create.length > 0 && `${plural(diff.create.length, "item")} to add`,
                  diff.restore.length > 0 && `${plural(diff.restore.length, "item")} to bring back`,
                  diff.archive.length > 0 && `${plural(diff.archive.length, "item")} to archive`,
                ]
                  .filter(Boolean)
                  .join(", ")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={apply} disabled={saving || changes === 0 || (needsConfirm && !allowStarted)}>
              {saving ? "Applying" : "Apply plan"}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </>
  );
}
