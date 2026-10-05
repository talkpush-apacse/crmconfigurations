"use client";

import { useState } from "react";
import { Check, Copy, Eye, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { formatDate } from "@/lib/tracker/format";
import type { createContributorLink } from "@/lib/tracker/contributor-service";
import type { createViewerLink, listShareLinks } from "@/lib/tracker/share-service";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { ConfirmDialog } from "./ConfirmDialog";
import { Field, FormError } from "./Field";

type LinkDTO = Awaited<ReturnType<typeof listShareLinks>>[number];
type CreatedLink = Awaited<ReturnType<typeof createViewerLink>>;
type CreatedContributor = Awaited<ReturnType<typeof createContributorLink>>;
type Contact = { id: string; name: string };

const NEVER = "never";

/** Staff-only: create, copy and revoke the read-only client links for one project. */
export function ShareDialog({ open, onOpenChange, projectId, contacts }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string; contacts: Contact[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">{open && <ShareBody projectId={projectId} contacts={contacts} />}</DialogContent>
    </Dialog>
  );
}

function statusOf(l: LinkDTO): { text: string; tone: "ok" | "off" } {
  if (l.revokedAt) return { text: "Revoked", tone: "off" };
  if (l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now()) return { text: "Expired", tone: "off" };
  return { text: "Active", tone: "ok" };
}

function ShareBody({ projectId, contacts }: { projectId: string; contacts: Contact[] }) {
  const { data, error, reload } = useApiResource<{ links: LinkDTO[] }>(`/api/tracker/projects/${projectId}/share-links`);
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("90");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<LinkDTO | null>(null);
  const [contactId, setContactId] = useState("");
  const [cExpiry, setCExpiry] = useState("90");
  const [assign, setAssign] = useState(false);
  const [cCreating, setCCreating] = useState(false);
  const [cError, setCError] = useState("");
  const [cFresh, setCFresh] = useState<{ url: string; expiresAt: string; contact: string; assigned: number } | null>(null);
  const [cCopied, setCCopied] = useState(false);

  const createContributor = async () => {
    setCCreating(true);
    setCError("");
    try {
      const created = await api<CreatedContributor>(`/api/tracker/projects/${projectId}/contributor-links`, {
        method: "POST",
        body: { personId: contactId, expiresInDays: Number(cExpiry), assignUnassigned: assign },
      });
      setCFresh({ url: `${window.location.origin}/contribute/${created.token}`, expiresAt: created.expiresAt, contact: created.contact, assigned: created.itemsAssigned });
      setCCopied(false);
      reload();
    } catch (err) {
      setCError(errorMessage(err));
    } finally {
      setCCreating(false);
    }
  };

  const copyContributor = async () => {
    if (!cFresh) return;
    try {
      await navigator.clipboard.writeText(cFresh.url);
      setCCopied(true);
    } catch {
      setCError("Copy did not work. Select the link and copy it by hand.");
    }
  };

  const create = async () => {
    setCreating(true);
    setFormError("");
    try {
      const created = await api<CreatedLink>(`/api/tracker/projects/${projectId}/share-links`, {
        method: "POST",
        body: { label, expiresInDays: expiry === NEVER ? null : Number(expiry) },
      });
      setFresh({ url: `${window.location.origin}/share/${created.token}`, expiresAt: created.expiresAt });
      setCopied(false);
      setLabel("");
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
    } catch {
      setFormError("Copy did not work. Select the link and copy it by hand.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Share with the client</DialogTitle>
        <DialogDescription>
          A private link to a read-only summary. Anyone with the link can see it, so send it only to the people who should. It never shows team-only items, internal remarks, blocker reasons or email addresses.
        </DialogDescription>
      </DialogHeader>

      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/admin/tracker/projects/${projectId}/client-preview`}>
          <Eye className="h-4 w-4" />
          Preview what the client sees
        </Link>
      </Button>

      {fresh ? (
        <div className="space-y-2 rounded-lg border border-border bg-secondary p-4" role="status">
          <p className="text-sm font-medium">Your link is ready. Copy it now: it is shown only once.</p>
          <div className="flex gap-2">
            <Input readOnly value={fresh.url} aria-label="Client link" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" onClick={copy} variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {fresh.expiresAt ? `Stops working on ${formatDate(fresh.expiresAt.slice(0, 10))}.` : "Never expires."} You can revoke it below at any time. If you lose it, revoke it and make a new one.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setFresh(null)}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">Create a new link</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who is it for?" htmlFor="share-label" hint="Only you see this label.">
              <Input id="share-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Ana Reyes, Northwind" />
            </Field>
            <Field label="Stops working after" htmlFor="share-expiry">
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger id="share-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value={NEVER}>Never (revoke it by hand)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <FormError message={formError} />
          <Button type="button" onClick={create} disabled={creating}>
            <Link2 className="h-4 w-4" />
            {creating ? "Creating..." : "Create link"}
          </Button>
        </div>
      )}

      <section aria-labelledby="share-contributor" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 id="share-contributor" className="text-sm font-semibold">
            Let a client contact add and update items
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A private link for one person. They see the same client-safe summary, can add items (these show a &quot;needs review&quot; flag for you), and can update the items assigned to them. They cannot see team-only items or change anything else.
          </p>
        </div>
        {cFresh ? (
          <div className="space-y-2 rounded-lg border border-border bg-secondary p-4" role="status">
            <p className="text-sm font-medium">Link for {cFresh.contact} is ready. Copy it now: it is shown only once.</p>
            <div className="flex gap-2">
              <Input readOnly value={cFresh.url} aria-label="Contributor link" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" onClick={copyContributor} variant="outline">
                {cCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {cCopied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stops working on {formatDate(cFresh.expiresAt.slice(0, 10))}.
              {cFresh.assigned > 0 ? ` ${cFresh.assigned} unassigned item${cFresh.assigned === 1 ? " was" : "s were"} assigned to ${cFresh.contact}.` : ""} You can revoke it below at any time.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCFresh(null)}>
              Done
            </Button>
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no client contacts for this account yet. Add one on the Team page first.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client contact" htmlFor="contrib-contact">
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger id="contrib-contact" className="w-full">
                    <SelectValue placeholder="Choose a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stops working after" htmlFor="contrib-expiry">
                <Select value={cExpiry} onValueChange={setCExpiry}>
                  <SelectTrigger id="contrib-expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={assign} onCheckedChange={(v) => setAssign(v === true)} />
              <span>Also assign this contact every unassigned &quot;Client does this&quot; item, so they can update them.</span>
            </label>
            <FormError message={cError} />
            <Button type="button" onClick={createContributor} disabled={cCreating || !contactId}>
              <Link2 className="h-4 w-4" />
              {cCreating ? "Creating..." : "Create contributor link"}
            </Button>
          </>
        )}
      </section>

      <section aria-labelledby="share-existing">
        <h3 id="share-existing" className="mb-2 text-sm font-semibold">
          Existing links
        </h3>
        {error && !data ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : data.links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {data.links.map((l) => {
              const st = statusOf(l);
              return (
                <li key={l.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {l.kind === "contributor" ? `${l.contact ?? l.label ?? "Contact"}: can add and update items` : l.label || "Unlabelled link"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{l.hint}</span>. Created {formatDate(l.createdAt.slice(0, 10))}
                      {l.expiresAt ? `, expires ${formatDate(l.expiresAt.slice(0, 10))}` : ", no expiry"}
                      {l.lastUsedAt ? `. Last opened ${formatDate(l.lastUsedAt.slice(0, 10))}` : ". Not opened yet"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={st.tone === "ok" ? "rounded-full border border-status-completed/50 bg-status-completed/25 px-2.5 py-0.5 text-xs font-medium" : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"}>
                      {st.text}
                    </span>
                    {st.tone === "ok" && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRevoking(l)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DialogFooter />

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this link?"
        description="Anyone using it will see a 'link not available' page straight away. This cannot be undone, but you can make a new link."
        confirmLabel="Revoke link"
        onConfirm={async () => {
          if (!revoking) return;
          await api(`/api/tracker/share-links/${revoking.id}`, { method: "DELETE" });
          reload();
        }}
      />
    </>
  );
}
