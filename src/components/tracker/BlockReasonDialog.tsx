"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ItemDTO } from "@/lib/tracker/client-types";
import { Field, FormError } from "./Field";

interface Props {
  item: ItemDTO | null;
  onCancel: () => void;
  /** Resolve with an error message to show, or null when saved. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/** Asks for the reason before an item can be marked blocked. Shared by the list and the board. */
export function BlockReasonDialog({ item, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {/* keyed by item so the form starts fresh for each one */}
        {item && <BlockForm key={item.id} item={item} onCancel={onCancel} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function BlockForm({ item, onCancel, onConfirm }: Props & { item: ItemDTO }) {
  const [reason, setReason] = useState(item.blockerReason ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const err = await onConfirm(reason);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Why is this blocked?</DialogTitle>
        <DialogDescription>{item.title}</DialogDescription>
      </DialogHeader>
      <Field label="Blocker reason" htmlFor="block-reason" required hint="Shown to your team. Clients do not see this.">
        <Textarea id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus />
      </Field>
      <FormError message={error} />
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={confirm} disabled={busy || reason.trim() === ""}>
          {busy ? "Saving..." : "Mark as blocked"}
        </Button>
      </DialogFooter>
    </>
  );
}
