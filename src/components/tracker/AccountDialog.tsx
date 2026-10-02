"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { AccountDTO } from "@/lib/tracker/client-types";
import { Field, FormError } from "./Field";

export function AccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountDTO | null;
  onSaved: (account: AccountDTO) => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(account?.name ?? "");
      setNotes(account?.notes ?? "");
      setError("");
    }
  }, [open, account]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = account
        ? await api<AccountDTO>(`/api/tracker/accounts/${account.id}`, { method: "PATCH", body: { name, notes } })
        : await api<AccountDTO>("/api/tracker/accounts", { method: "POST", body: { name, notes } });
      onSaved(saved);
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
            <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
            <DialogDescription>An account is a client company. It can have many projects.</DialogDescription>
          </DialogHeader>
          <Field label="Company name" htmlFor="account-name" required>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
          </Field>
          <Field label="Notes" htmlFor="account-notes" hint="Internal only. Clients never see this.">
            <Textarea id="account-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || name.trim() === ""}>
              {saving ? "Saving..." : account ? "Save account" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
