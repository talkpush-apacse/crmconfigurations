"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { serializeMetric } from "@/lib/tracker/metric-service";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, FormError } from "./Field";

export type MetricDTO = ReturnType<typeof serializeMetric>;

const toNumber = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const fromNumber = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

interface MetricProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  metric: MetricDTO | null;
  onSaved: () => void;
}

export function MetricDialog(props: MetricProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {props.open && <MetricForm key={props.metric?.id ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function MetricForm({ onOpenChange, projectId, metric, onSaved }: MetricProps) {
  const editing = !!metric;
  const [name, setName] = useState(metric?.name ?? "");
  const [unit, setUnit] = useState(metric?.unit ?? "");
  const [direction, setDirection] = useState(metric?.direction ?? "higher_is_better");
  const [baseline, setBaseline] = useState(fromNumber(metric?.baselineValue));
  const [baselineDate, setBaselineDate] = useState(metric?.baselineDate ?? "");
  const [target, setTarget] = useState(fromNumber(metric?.targetValue));
  const [current, setCurrent] = useState(fromNumber(metric?.currentValue));
  const [source, setSource] = useState(metric?.source ?? "");
  const [visibility, setVisibility] = useState(metric?.visibility ?? "client_visible");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      name,
      unit,
      direction,
      baselineValue: toNumber(baseline),
      baselineDate,
      targetValue: toNumber(target),
      source,
      visibility,
      ...(editing ? {} : { currentValue: toNumber(current) }),
    };
    try {
      if (editing) await api(`/api/tracker/metrics/${metric!.id}`, { method: "PATCH", body });
      else await api(`/api/tracker/projects/${projectId}/metrics`, { method: "POST", body });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit metric" : "Add success metric"}</DialogTitle>
          <DialogDescription>A number that shows whether the project is working, with where it started and where it should end up.</DialogDescription>
        </DialogHeader>
        <Field label="Metric name" htmlFor="metric-name" required>
          <Input id="metric-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} autoFocus placeholder="Time to hire" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit" htmlFor="metric-unit" required hint="For example days, %, candidates per week">
            <Input id="metric-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Better when it goes" htmlFor="metric-direction">
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger id="metric-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Up</SelectItem>
                <SelectItem value="lower_is_better">Down</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Baseline" htmlFor="metric-baseline" hint="Where it started">
            <Input id="metric-baseline" type="number" step="any" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
          </Field>
          <Field label="Baseline date" htmlFor="metric-baseline-date">
            <Input id="metric-baseline-date" type="date" value={baselineDate} onChange={(e) => setBaselineDate(e.target.value)} />
          </Field>
          <Field label="Target" htmlFor="metric-target" hint="Where it should end up">
            <Input id="metric-target" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        {!editing && (
          <Field label="Current value" htmlFor="metric-current" hint="Optional. You can record readings later.">
            <Input id="metric-current" type="number" step="any" value={current} onChange={(e) => setCurrent(e.target.value)} className="sm:max-w-40" />
          </Field>
        )}
        <Field label="Where the number comes from" htmlFor="metric-source">
          <Input id="metric-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={300} />
        </Field>
        <Field label="Who can see this metric" htmlFor="metric-visibility">
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger id="metric-visibility" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client_visible">The client can see it</SelectItem>
              <SelectItem value="internal">Talkpush team only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <FormError message={error} />
        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmArchive(true)} disabled={saving}>
              Archive metric
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || name.trim() === "" || unit.trim() === ""}>
              {saving ? "Saving..." : editing ? "Save metric" : "Add metric"}
            </Button>
          </div>
        </DialogFooter>
      </form>
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this metric?"
        description="It disappears from the project and from any client view. The readings are kept."
        confirmLabel="Archive metric"
        onConfirm={async () => {
          await api(`/api/tracker/metrics/${metric!.id}`, { method: "PATCH", body: { archived: true } });
          onSaved();
          onOpenChange(false);
        }}
      />
    </>
  );
}

interface ReadingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricDTO | null;
  today: string;
  onSaved: () => void;
}

export function ReadingDialog(props: ReadingProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">{props.open && props.metric && <ReadingForm key={props.metric.id} {...props} metric={props.metric} />}</DialogContent>
    </Dialog>
  );
}

function ReadingForm({ onOpenChange, metric, today, onSaved }: ReadingProps & { metric: MetricDTO }) {
  const [value, setValue] = useState("");
  const [asOf, setAsOf] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const n = toNumber(value);
    if (n === null) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api(`/api/tracker/metrics/${metric.id}/readings`, { method: "POST", body: { value: n, asOf, note } });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Record a reading</DialogTitle>
        <DialogDescription>{metric.name}, in {metric.unit}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Value" htmlFor="reading-value" required>
          <Input id="reading-value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <Field label="Measured on" htmlFor="reading-date">
          <Input id="reading-date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      </div>
      <Field label="Note" htmlFor="reading-note" hint="Team only. Clients do not see this.">
        <Textarea id="reading-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
      </Field>
      <FormError message={error} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || value.trim() === ""}>
          {saving ? "Saving..." : "Record reading"}
        </Button>
      </DialogFooter>
    </form>
  );
}
