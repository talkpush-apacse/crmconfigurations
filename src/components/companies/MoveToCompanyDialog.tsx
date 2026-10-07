"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormError } from "@/components/tracker/Field";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { AccountDTO } from "@/lib/tracker/client-types";
import { linkItem, type LinkKind } from "@/lib/companies/client";

/** Move a checklist or workflow to another company. */
export function MoveToCompanyDialog({
  open,
  onOpenChange,
  kind,
  itemId,
  itemName,
  currentAccountId,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LinkKind;
  itemId: string;
  itemName: string;
  currentAccountId: string;
  onMoved: () => void;
}) {
  const [accounts, setAccounts] = useState<AccountDTO[] | null>(null);
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The dialog is mounted fresh each time it opens, so there is nothing to reset here.
    if (!open) return;
    let cancelled = false;
    api<{ accounts: AccountDTO[] }>("/api/tracker/accounts")
      .then((r) => !cancelled && setAccounts(r.accounts.filter((a) => a.id !== currentAccountId)))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [open, currentAccountId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await linkItem(kind, itemId, target);
      onMoved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Move to another company</DialogTitle>
            <DialogDescription>
              “{itemName}” will show under the company you pick. Nothing about it changes for the client.
            </DialogDescription>
          </DialogHeader>
          <Field label="Company" htmlFor="move-company" required>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="move-company" className="w-full">
                <SelectValue placeholder={accounts === null ? "Loading companies..." : "Choose a company"} />
              </SelectTrigger>
              <SelectContent>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !target}>
              {saving ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
