"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { AccountDTO, PersonDTO, ProjectDTO } from "@/lib/tracker/client-types";
import { HEALTH_LABELS, PROJECT_STATUS_LABELS, PROJECT_STATUSES, type HealthLevel } from "@/lib/tracker/constants";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, FormError, NONE } from "./Field";

const CALCULATED = "__calculated";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  project?: ProjectDTO | null;
  /** Create mode: the accounts to choose from. */
  accounts?: AccountDTO[];
  defaultAccountId?: string | null;
  /** Edit mode: people already loaded with the project. */
  people?: PersonDTO[];
  onSaved: (project: ProjectDTO) => void;
  onArchived?: () => void;
}

export function ProjectDialog({ open, onOpenChange, project, accounts = [], defaultAccountId, people, onSaved, onArchived }: Props) {
  const editing = !!project;
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [ownerId, setOwnerId] = useState(NONE);
  const [sponsorId, setSponsorId] = useState(NONE);
  const [status, setStatus] = useState("planned");
  const [override, setOverride] = useState(CALCULATED);
  const [overrideNote, setOverrideNote] = useState("");
  const [available, setAvailable] = useState<PersonDTO[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccountId(project?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
    setTitle(project?.title ?? "");
    setObjective(project?.objective ?? "");
    setStartDate(project?.startDate ?? "");
    setTargetDate(project?.targetDate ?? "");
    setGoLiveDate(project?.goLiveDate ?? "");
    setOwnerId(project?.owner?.id ?? NONE);
    setSponsorId(project?.sponsor?.id ?? NONE);
    setStatus(project?.status ?? "planned");
    setOverride(project?.healthOverride ?? CALCULATED);
    setOverrideNote(project?.healthOverrideNote ?? "");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  // People for the owner and sponsor pickers follow the chosen account.
  useEffect(() => {
    if (!open) return;
    if (people) {
      setAvailable(people);
      return;
    }
    if (!accountId) {
      setAvailable([]);
      return;
    }
    let cancelled = false;
    api<{ people: PersonDTO[] }>(`/api/tracker/people?accountId=${accountId}`)
      .then((r) => !cancelled && setAvailable(r.people))
      .catch(() => !cancelled && setAvailable([]));
    return () => {
      cancelled = true;
    };
  }, [open, accountId, people]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const common = {
      title,
      objective,
      startDate,
      targetDate,
      goLiveDate,
      ownerPersonId: ownerId === NONE ? null : ownerId,
      sponsorPersonId: sponsorId === NONE ? null : sponsorId,
    };
    try {
      const saved = editing
        ? await api<ProjectDTO>(`/api/tracker/projects/${project!.id}`, {
            method: "PATCH",
            body: {
              ...common,
              status,
              healthOverride: override === CALCULATED ? null : override,
              ...(override === CALCULATED ? {} : { healthOverrideNote: overrideNote }),
            },
          })
        : await api<ProjectDTO>("/api/tracker/projects", { method: "POST", body: { ...common, accountId } });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    await api(`/api/tracker/projects/${project!.id}`, { method: "PATCH", body: { archived: true } });
    onOpenChange(false);
    onArchived?.();
  };

  const personOptions = (side?: string) =>
    available
      .filter((p) => !side || p.side === side)
      .map((p) => (
        <SelectItem key={p.id} value={p.id}>
          {p.name}
          {p.side !== "talkpush" ? ` (${p.side})` : ""}
        </SelectItem>
      ));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? "Project settings" : "New project"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Dates, people and health for this project."
                  : "A project starts with the standard phases. You can add items next."}
              </DialogDescription>
            </DialogHeader>

            {!editing && (
              <Field label="Account" htmlFor="project-account" required>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Create an account first, then add its project.</p>
                ) : (
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="project-account" className="w-full">
                      <SelectValue placeholder="Choose an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}

            <Field label="Project title" htmlFor="project-title" required>
              <Input id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus />
            </Field>
            <Field label="Objective" htmlFor="project-objective" hint="One or two sentences on what success looks like.">
              <Textarea id="project-objective" value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} maxLength={2000} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start date" htmlFor="project-start">
                <Input id="project-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Target date" htmlFor="project-target">
                <Input id="project-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </Field>
              <Field label="Go-live date" htmlFor="project-golive">
                <Input id="project-golive" type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} />
              </Field>
            </div>
            {editing && project?.targetDate && targetDate !== project.targetDate && (
              <p className="text-xs text-muted-foreground">Changing the target date counts as a reschedule and is shown on the project.</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project owner" htmlFor="project-owner">
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="project-owner" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No owner yet</SelectItem>
                    {personOptions()}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sponsor" htmlFor="project-sponsor">
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger id="project-sponsor" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No sponsor yet</SelectItem>
                    {personOptions()}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {editing && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status" htmlFor="project-status">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="project-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PROJECT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Health" htmlFor="project-health" hint="Calculated from open items unless you set it by hand.">
                    <Select value={override} onValueChange={setOverride}>
                      <SelectTrigger id="project-health" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CALCULATED}>Calculated automatically</SelectItem>
                        {(Object.keys(HEALTH_LABELS) as HealthLevel[]).map((h) => (
                          <SelectItem key={h} value={h}>
                            Set to {HEALTH_LABELS[h].toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                {override !== CALCULATED && (
                  <Field label="Why are you overriding the health?" htmlFor="project-health-note" required hint="Shown next to the health badge.">
                    <Textarea id="project-health-note" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} rows={2} maxLength={500} />
                  </Field>
                )}
              </>
            )}

            <FormError message={error} />
            <DialogFooter className="gap-2 sm:justify-between">
              {editing ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmArchive(true)} disabled={saving}>
                  Archive project
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || title.trim() === "" || (!editing && !accountId)}>
                  {saving ? "Saving..." : editing ? "Save project" : "Create project"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this project?"
        description="It disappears from the portfolio but nothing is deleted. You can restore it later."
        confirmLabel="Archive project"
        onConfirm={archive}
      />
    </>
  );
}
