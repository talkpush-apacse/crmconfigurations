"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/tracker/client-api";
import type { PersonDTO } from "@/lib/tracker/client-types";
import { Field, FormError } from "./Field";

/** accountId set = a client contact or vendor of that account. accountId null = Talkpush team member. */
export function PersonDialog({
  open,
  onOpenChange,
  accountId,
  person,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  person?: PersonDTO | null;
  onSaved: (person: PersonDTO) => void;
}) {
  const [side, setSide] = useState<"client" | "vendor">("client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSide(person?.side === "vendor" ? "vendor" : "client");
      setName(person?.name ?? "");
      setEmail(person?.email ?? "");
      setTitle(person?.title ?? "");
      setOrganisation(person?.organisation ?? "");
      setError("");
    }
  }, [open, person]);

  const isTeam = accountId === null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = person
        ? await api<PersonDTO>(`/api/tracker/people/${person.id}`, {
            method: "PATCH",
            body: { name, email, title, organisation },
          })
        : await api<PersonDTO>("/api/tracker/people", {
            method: "POST",
            body: { accountId, side: isTeam ? "talkpush" : side, name, email, title, organisation },
          });
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
            <DialogTitle>{person ? "Edit person" : isTeam ? "Add team member" : "Add contact"}</DialogTitle>
            <DialogDescription>
              {isTeam
                ? "Talkpush staff who can own items on any project."
                : "Client contacts and vendors can own items on this account's projects."}
            </DialogDescription>
          </DialogHeader>
          {!isTeam && !person && (
            <Field label="Type" htmlFor="person-side">
              <Select value={side} onValueChange={(v) => setSide(v as "client" | "vendor")}>
                <SelectTrigger id="person-side" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client contact</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Name" htmlFor="person-name" required>
            <Input id="person-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
          </Field>
          <Field label="Email" htmlFor="person-email">
            <Input id="person-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="person-title">
              <Input id="person-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </Field>
            {!isTeam && (
              <Field label="Organisation" htmlFor="person-org" hint={side === "vendor" ? "The vendor's company." : undefined}>
                <Input id="person-org" value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={160} />
              </Field>
            )}
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || name.trim() === ""}>
              {saving ? "Saving..." : person ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
