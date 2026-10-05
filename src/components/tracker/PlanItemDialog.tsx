"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import {
  DEFAULT_PHASES,
  ITEM_TYPE_LABELS,
  ITEM_TYPES,
  PLAN_AUDIENCE_LABELS,
  PLAN_AUDIENCES,
  PRIORITIES,
} from "@/lib/tracker/constants";
import { describeTiming } from "@/lib/tracker/plan-schedule";
import type { PlanTemplateItemDTO } from "@/lib/tracker/plan-service";
import { Field, FormError } from "./Field";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  item?: PlanTemplateItemDTO | null;
  /** Every other item, for the "waits on" list and the group suggestions. */
  allItems: PlanTemplateItemDTO[];
  onSaved: () => void;
}

const toNumber = (v: string): number | null => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/** Add or edit one item of the standard plan. */
export function PlanItemDialog({ open, onOpenChange, item, allItems, onSaved }: Props) {
  const editing = !!item;
  const [title, setTitle] = useState("");
  const [phaseName, setPhaseName] = useState<string>(DEFAULT_PHASES[0]);
  const [groupName, setGroupName] = useState("");
  const [audience, setAudience] = useState<string>("shared");
  const [type, setType] = useState<string>("config");
  const [priority, setPriority] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [milestone, setMilestone] = useState(false);
  const [defaultIncluded, setDefaultIncluded] = useState(true);
  const [waitsOn, setWaitsOn] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setPhaseName(item?.phaseName ?? DEFAULT_PHASES[0]);
    setGroupName(item?.groupName ?? "");
    setAudience(item?.audience ?? "shared");
    setType(item?.type ?? "config");
    setPriority(item?.priority ?? "medium");
    setDescription(item?.description ?? "");
    setStartDay(item?.startDay?.toString() ?? "");
    setEndDay(item?.endDay?.toString() ?? "");
    setMilestone(item?.isMilestone ?? false);
    setDefaultIncluded(item?.defaultIncluded ?? true);
    setWaitsOn(new Set(item?.dependsOnKeys ?? []));
    setFilter("");
    setError("");
  }, [open, item]);

  const groups = useMemo(() => [...new Set(allItems.map((i) => i.groupName))], [allItems]);
  const candidates = useMemo(
    () =>
      allItems
        .filter((i) => i.key !== item?.key && !i.archived)
        .filter((i) => !filter || i.title.toLowerCase().includes(filter.toLowerCase())),
    [allItems, item, filter]
  );

  const timing = describeTiming(toNumber(startDay), toNumber(endDay));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      title,
      phaseName,
      groupName,
      audience,
      type,
      priority,
      description,
      startDay: toNumber(startDay),
      endDay: toNumber(endDay),
      isMilestone: milestone,
      defaultIncluded,
      dependsOnKeys: [...waitsOn],
    };
    try {
      if (editing) await api(`/api/tracker/plan-template/items/${item!.id}`, { method: "PATCH", body });
      else await api("/api/tracker/plan-template/items", { method: "POST", body });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (archived: boolean) => {
    setSaving(true);
    setError("");
    try {
      await api(`/api/tracker/plan-template/items/${item!.id}`, { method: "PATCH", body: { archived } });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleWait = (key: string, on: boolean) =>
    setWaitsOn((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan item" : "Add a plan item"}</DialogTitle>
            <DialogDescription>
              Changes apply to plans built from now on. Projects that already have this item keep their own copy.
            </DialogDescription>
          </DialogHeader>

          <Field label="Title" htmlFor="plan-title" required>
            <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phase" htmlFor="plan-phase">
              <Select value={phaseName} onValueChange={setPhaseName}>
                <SelectTrigger id="plan-phase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_PHASES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Group" htmlFor="plan-group" required hint="Items in the same group are ticked together.">
              <Input id="plan-group" list="plan-groups" value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={80} required />
              <datalist id="plan-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Who is it for" htmlFor="plan-audience">
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger id="plan-audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>{PLAN_AUDIENCE_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type" htmlFor="plan-type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="plan-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ITEM_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority" htmlFor="plan-priority">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="plan-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {audience !== "internal" && (
            <p className="-mt-2 text-xs text-muted-foreground">
              The client sees this item and its description. Keep the wording plain and leave out internal team names, tickets and tools.
            </p>
          )}

          <Field label="Description" htmlFor="plan-description">
            <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts on working day" htmlFor="plan-start" hint="Counted from the project start. Week 1 is days 1 to 5, week 2 is days 6 to 10.">
              <Input id="plan-start" type="number" min={1} max={200} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
            </Field>
            <Field label="Due on working day" htmlFor="plan-end" hint={`Timing: ${timing}.`}>
              <Input id="plan-end" type="number" min={1} max={200} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <Checkbox checked={milestone} onCheckedChange={(v) => setMilestone(v === true)} />
              Milestone (counts towards project health)
            </label>
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <Checkbox checked={defaultIncluded} onCheckedChange={(v) => setDefaultIncluded(v === true)} />
              Ticked by default
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Waits on ({waitsOn.size})</legend>
            <Input aria-label="Filter items" placeholder="Filter items" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
              {candidates.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">No items match.</p>}
              {candidates.map((c) => (
                <label key={c.key} className="flex min-h-8 items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                  <Checkbox className="mt-0.5" checked={waitsOn.has(c.key)} onCheckedChange={(v) => toggleWait(c.key, v === true)} />
                  <span>
                    {c.title} <span className="text-xs text-muted-foreground">({c.phaseName}, {c.timing})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormError message={error} />
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && (
                <Button type="button" variant="outline" disabled={saving} onClick={() => setArchived(!item!.archived)}>
                  {item!.archived ? "Restore to the plan" : "Archive"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !title.trim() || !groupName.trim()}>
                {saving ? "Saving" : editing ? "Save changes" : "Add item"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
