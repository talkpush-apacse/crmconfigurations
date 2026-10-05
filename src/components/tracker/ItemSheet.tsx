"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { ItemDTO, PersonDTO, PhaseDTO, RemarkDTO } from "@/lib/tracker/client-types";
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  PERSON_SIDE_LABELS,
  PRIORITIES,
  type PersonSide,
} from "@/lib/tracker/constants";
import { formatDate } from "@/lib/tracker/format";
import { conflictMessage, draftConflicts } from "@/lib/tracker/schedule";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, FormError, NONE } from "./Field";
import { ItemStatusBadge } from "./badges";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Present = edit mode. */
  item?: ItemDTO | null;
  items: ItemDTO[];
  phases: PhaseDTO[];
  people: PersonDTO[];
  /** Pre-select a phase when adding. */
  defaultPhaseId?: string | null;
  onSaved: () => void;
}

export function ItemSheet({ open, onOpenChange, projectId, item, items, phases, people, defaultPhaseId, onSaved }: Props) {
  const editing = !!item;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("not_started");
  const [blockerReason, setBlockerReason] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [type, setType] = useState("config");
  const [priority, setPriority] = useState("medium");
  const [ownerId, setOwnerId] = useState(NONE);
  const [phaseId, setPhaseId] = useState(NONE);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [visibility, setVisibility] = useState("client_visible");
  const [externalDependency, setExternalDependency] = useState("");
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setStatus(item?.status ?? "not_started");
    setBlockerReason(item?.blockerReason ?? "");
    setWaitingOn(item?.waitingOn ?? "");
    setType(item?.type ?? "config");
    setPriority(item?.priority ?? "medium");
    setOwnerId(item?.ownerPersonId ?? NONE);
    setPhaseId(item?.phaseId ?? defaultPhaseId ?? NONE);
    setStartDate(item?.startDate ?? "");
    setDueDate(item?.dueDate ?? "");
    setIsMilestone(item?.isMilestone ?? false);
    setVisibility(item?.visibility ?? "client_visible");
    setExternalDependency(item?.externalDependency ?? "");
    setBlockedBy(item?.blockedByItemIds ?? []);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const needsReason = status === "blocked" && blockerReason.trim() === "";
  // Warn when this item is planned to start before something it waits for is due.
  const conflicts = useMemo(
    () =>
      draftConflicts(
        { id: item?.id, title, status, startDate: startDate || null, dueDate: dueDate || null },
        blockedBy,
        items.map((i) => ({ id: i.id, title: i.title, status: i.status, startDate: i.startDate, dueDate: i.dueDate, isMilestone: i.isMilestone, blockedByItemIds: i.blockedByItemIds }))
      ),
    [item?.id, title, status, startDate, dueDate, blockedBy, items]
  );
  const others = items.filter((i) => i.id !== item?.id && !i.archived);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (needsReason) return;
    setSaving(true);
    setError("");
    const body = {
      title,
      description,
      status,
      blockerReason: status === "blocked" ? blockerReason : null,
      waitingOn: status === "waiting_on_client" ? waitingOn : null,
      type,
      priority,
      ownerPersonId: ownerId === NONE ? null : ownerId,
      phaseId: phaseId === NONE ? null : phaseId,
      startDate,
      dueDate,
      isMilestone,
      visibility,
      externalDependency,
      blockedByItemIds: blockedBy,
    };
    try {
      if (editing) {
        await api(`/api/tracker/items/${item!.id}`, { method: "PATCH", body });
      } else {
        await api(`/api/tracker/projects/${projectId}/items`, { method: "POST", body });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    await api(`/api/tracker/items/${item!.id}`, { method: "PATCH", body: { archived: true } });
    onSaved();
    onOpenChange(false);
  };

  const [reviewing, setReviewing] = useState(false);
  const markReviewed = async () => {
    if (!item) return;
    setReviewing(true);
    setError("");
    try {
      await api(`/api/tracker/items/${item.id}/review`, { method: "POST" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  const group = (side: PersonSide) => people.filter((p) => p.side === side);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-lg">
          <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border">
              <SheetTitle>{editing ? "Edit item" : "Add item"}</SheetTitle>
              <SheetDescription>
                {editing ? <ItemStatusBadge status={item!.status} /> : "Something that has to happen for this project to succeed."}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {editing && item!.createdVia === "client" && (
                <div role="status" className="rounded-md border border-status-pending/50 bg-status-pending/15 p-3 text-sm">
                  <p className="font-medium">{item!.needsReview ? "Added by the client. Needs your review." : "Added by the client. Reviewed."}</p>
                  {item!.needsReview && (
                    <>
                      <p className="mt-1 text-muted-foreground">
                        The client can already see it. It does not count toward project health until you mark it reviewed. Set its type, phase and dates first if it needs them.
                      </p>
                      <Button type="button" size="sm" className="mt-2" disabled={reviewing} onClick={markReviewed}>
                        {reviewing ? "Saving" : "Mark reviewed"}
                      </Button>
                    </>
                  )}
                </div>
              )}
              <Field label="Title" htmlFor="item-title" required>
                <Input id="item-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus={!editing} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" htmlFor="item-status">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="item-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ITEM_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Owner" htmlFor="item-owner">
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="item-owner" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No owner yet</SelectItem>
                      {(["talkpush", "client", "vendor"] as PersonSide[]).map((side) =>
                        group(side).length === 0 ? null : (
                          <div key={side}>
                            <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{PERSON_SIDE_LABELS[side]}</p>
                            {group(side).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </div>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {status === "blocked" && (
                <Field label="Why is this blocked?" htmlFor="item-blocker" required hint="Shown to your team. Clients do not see this.">
                  <Textarea id="item-blocker" value={blockerReason} onChange={(e) => setBlockerReason(e.target.value)} rows={2} maxLength={500} />
                </Field>
              )}
              {status === "waiting_on_client" && (
                <Field label="Waiting on" htmlFor="item-waiting" hint="What or who we are waiting for.">
                  <Input id="item-waiting" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} maxLength={200} />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start date" htmlFor="item-start">
                  <Input id="item-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Due date" htmlFor="item-due">
                  <Input id="item-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Phase" htmlFor="item-phase">
                  <Select value={phaseId} onValueChange={setPhaseId}>
                    <SelectTrigger id="item-phase" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No phase</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Type" htmlFor="item-type">
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="item-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ITEM_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="item-priority">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="item-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="item-milestone" checked={isMilestone} onCheckedChange={(v) => setIsMilestone(v === true)} className="mt-0.5" />
                <Label htmlFor="item-milestone" className="text-sm font-normal leading-snug">
                  This is a milestone
                  <span className="block text-xs text-muted-foreground">Milestones drive project health and appear on the timeline.</span>
                </Label>
              </div>

              <Field label="Description" htmlFor="item-description">
                <Textarea id="item-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} />
              </Field>

              <Field label="Who can see this item" htmlFor="item-visibility" hint="Internal items never appear on client links.">
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger id="item-visibility" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_visible">The client can see it</SelectItem>
                    <SelectItem value="internal">Talkpush team only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Blocked by other items</legend>
                {others.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other items in this project yet.</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-2">
                    {others.map((o) => (
                      <li key={o.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`dep-${o.id}`}
                          checked={blockedBy.includes(o.id)}
                          onCheckedChange={(v) => setBlockedBy((prev) => (v === true ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                        />
                        <Label htmlFor={`dep-${o.id}`} className="flex-1 truncate text-sm font-normal">
                          {o.title}
                        </Label>
                        <ItemStatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                )}
                {conflicts.length > 0 && (
                  <ul role="alert" className="space-y-1 rounded-md border border-status-pending/60 bg-status-pending/15 px-3 py-2 text-xs">
                    {conflicts.map((c) => (
                      <li key={c.blockerId} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{conflictMessage(c)} Move one of the dates, or remove the dependency.</span>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>

              <Field label="Waiting on something outside the project" htmlFor="item-external" hint="For example: client IT whitelisting the sender domain.">
                <Input id="item-external" value={externalDependency} onChange={(e) => setExternalDependency(e.target.value)} maxLength={300} />
              </Field>

              {editing && <RemarksPanel itemId={item!.id} />}
            </div>

            <SheetFooter className="border-t border-border bg-background">
              <FormError message={error} />
              {needsReason && <p className="text-xs text-muted-foreground">Add a reason to mark this item as blocked.</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                {editing ? (
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmArchive(true)} disabled={saving}>
                    Archive item
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || title.trim() === "" || needsReason}>
                    {saving ? "Saving..." : editing ? "Save item" : "Add item"}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this item?"
        description="It disappears from the project but is kept in the activity history."
        confirmLabel="Archive item"
        onConfirm={archive}
      />
    </>
  );
}

function RemarksPanel({ itemId }: { itemId: string }) {
  const [remarks, setRemarks] = useState<RemarkDTO[] | null>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRemarks(null);
    api<{ remarks: RemarkDTO[] }>(`/api/tracker/items/${itemId}/remarks`)
      .then((r) => !cancelled && setRemarks(r.remarks))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const add = async () => {
    setSaving(true);
    setError("");
    try {
      const created = await api<RemarkDTO>(`/api/tracker/items/${itemId}/remarks`, { method: "POST", body: { body, visibility } });
      setRemarks((prev) => [created, ...(prev ?? [])]);
      setBody("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="remarks-heading" className="space-y-3 border-t border-border pt-4">
      <h3 id="remarks-heading" className="text-sm font-semibold">
        Remarks
      </h3>
      <div className="space-y-2">
        <Label htmlFor="remark-body" className="sr-only">
          New remark
        </Label>
        <Textarea id="remark-body" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={4000} placeholder="Write a remark" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger aria-label="Who can see this remark" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Talkpush team only</SelectItem>
              <SelectItem value="shared">Shared with the client</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={add} disabled={saving || body.trim() === ""}>
            {saving ? "Adding..." : "Add remark"}
          </Button>
        </div>
        <FormError message={error} />
      </div>
      {remarks === null ? (
        <p className="text-xs text-muted-foreground">Loading remarks...</p>
      ) : remarks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No remarks yet.</p>
      ) : (
        <ul className="space-y-2">
          {remarks.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card p-3">
              <p className="whitespace-pre-wrap text-sm">{r.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.authorLabel} on {formatDate(r.createdAt.slice(0, 10))}
                {r.createdVia === "mcp" ? " via Claude" : ""}
                {" · "}
                {r.visibility === "shared" ? "Shared with client" : "Team only"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
