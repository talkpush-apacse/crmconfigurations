"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { PhaseDTO } from "@/lib/tracker/client-types";
import { FormError } from "./Field";

type PhaseDates = Pick<PhaseDTO, "id" | "name" | "startDate" | "endDate">;

/** Set start and end dates for each phase. The timeline draws a band for every phase that has dates. */
export function PhaseDatesDialog({ open, onOpenChange, phases, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; phases: readonly PhaseDates[]; onSaved: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{open && <PhaseForm phases={phases} onOpenChange={onOpenChange} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}

function PhaseForm({ phases, onOpenChange, onSaved }: { phases: readonly PhaseDates[]; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, { start: string; end: string }>>(
    Object.fromEntries(phases.map((p) => [p.id, { start: p.startDate ?? "", end: p.endDate ?? "" }]))
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (id: string, key: "start" | "end", value: string) => setValues((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      for (const p of phases) {
        const v = values[p.id];
        if ((p.startDate ?? "") === v.start && (p.endDate ?? "") === v.end) continue;
        await api(`/api/tracker/phases/${p.id}`, { method: "PATCH", body: { startDate: v.start, endDate: v.end } });
      }
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
        <DialogTitle>Phase dates</DialogTitle>
        <DialogDescription>The timeline shows a band for each phase that has dates. Leave both blank to hide a phase&apos;s band.</DialogDescription>
      </DialogHeader>
      <ul className="space-y-3">
        {phases.map((p) => (
          <li key={p.id} className="grid items-end gap-2 sm:grid-cols-[1fr_9.5rem_9.5rem]">
            <p className="text-sm font-medium">{p.name}</p>
            <div className="space-y-1">
              <Label htmlFor={`ps-${p.id}`} className="text-xs text-muted-foreground">
                Starts
              </Label>
              <Input id={`ps-${p.id}`} type="date" value={values[p.id].start} onChange={(e) => set(p.id, "start", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`pe-${p.id}`} className="text-xs text-muted-foreground">
                Ends
              </Label>
              <Input id={`pe-${p.id}`} type="date" value={values[p.id].end} onChange={(e) => set(p.id, "end", e.target.value)} />
            </div>
          </li>
        ))}
      </ul>
      <FormError message={error} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save phase dates"}
        </Button>
      </DialogFooter>
    </form>
  );
}
