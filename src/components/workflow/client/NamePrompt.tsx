"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** Shared-link visitors give a name once, so comments and edits show who made them. It is not checked, so it shows as unverified. */
export default function NamePrompt({
  open,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  onSubmit: (name: string, email?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), email.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>What should we call you?</DialogTitle>
            <DialogDescription>
              Your name appears next to your comments and changes. We do not check it, so it is shown as unverified.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-3">
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus aria-label="Your name" />
            <Input type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email (optional)" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>Not now</Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
