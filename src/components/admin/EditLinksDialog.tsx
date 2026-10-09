"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, History, Link2, Loader2, Pencil, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import type { EditLinkRow } from "@/lib/edit-history/types";

/**
 * One personal link per person who edits a checklist, so the Edit history can say who changed what.
 * Links are copied and pasted into your own email; nothing is sent from here and clients never need an account.
 * Unlike the Workflow Builder, a link here can be copied again at any time (like the original editor link).
 */

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: { error?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

function editorUrl(token: string) {
  return `${window.location.origin}/editor/${token}/welcome`;
}

export function EditLinksDialog({
  checklistId,
  clientName,
  open,
  onOpenChange,
}: {
  checklistId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [links, setLinks] = useState<EditLinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ links: EditLinkRow[] }>(`/api/checklists/${checklistId}/edit-links`);
      setLinks(r.links);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the links.");
    }
  }, [checklistId]);

  useEffect(() => {
    if (!open) return;
    setLinks(null);
    setNotice(null);
    setConfirmOff(null);
    setConfirmNew(null);
    setRenaming(null);
    void load();
  }, [open, load]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(link: EditLinkRow) {
    if (await copyToClipboard(editorUrl(link.token))) {
      setCopiedId(link.id);
      setNotice(`Link for ${link.name} copied. Paste it into your email.`);
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 2500);
    } else {
      setNotice("Could not copy. Select the link below and copy it by hand.");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await run("create", async () => {
      const r = await api<{ link: EditLinkRow }>(`/api/checklists/${checklistId}/edit-links`, send("POST", { name: trimmed }));
      setName("");
      await load();
      await copy(r.link);
    });
  }

  async function rename(link: EditLinkRow, value: string) {
    await run(`rename-${link.id}`, async () => {
      await api(`/api/checklists/${checklistId}/edit-links/${link.id}`, send("PATCH", { name: value }));
      setRenaming(null);
      await load();
      setNotice("Renamed. Changes already recorded keep the old name; new ones use the new name.");
    });
  }

  async function newAddress(link: EditLinkRow) {
    await run(`new-${link.id}`, async () => {
      const r = await api<{ link: EditLinkRow }>(`/api/checklists/${checklistId}/edit-links/${link.id}`, send("PATCH", { regenerate: true }));
      setConfirmNew(null);
      await load();
      await copy(r.link);
      setNotice(`New link for ${link.name} copied. The old address no longer works.`);
    });
  }

  async function turnOff(link: EditLinkRow) {
    await run(`off-${link.id}`, async () => {
      await api(`/api/checklists/${checklistId}/edit-links/${link.id}`, send("DELETE"));
      setConfirmOff(null);
      await load();
      setNotice(`${link.name}'s link is turned off. Their past changes stay in the history.`);
    });
  }

  const active = (links ?? []).filter((l) => !l.revokedAt);
  const off = (links ?? []).filter((l) => l.revokedAt);
  const isExpired = (l: EditLinkRow) => !!l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit links for {clientName}</DialogTitle>
          <DialogDescription>
            Give each person their own link. Everything they change is recorded under their name in the edit history.
            Copy a link and paste it into your own email; nothing is sent from here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Person's name, e.g. Jane Cruz (TP)"
            maxLength={80}
            aria-label="Name for the new link"
            className="h-11 sm:h-9"
          />
          <Button type="submit" disabled={busy === "create" || !name.trim()} className="h-11 sm:h-9">
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create link
          </Button>
        </form>

        <p role="status" aria-live="polite" className={notice ? "rounded-md bg-muted p-3 text-sm text-foreground" : "sr-only"}>
          {notice ?? ""}
        </p>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
          </div>
        )}
        {!links && !error && (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        )}

        {links && (
          <div className="space-y-5 text-sm">
            {active.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Link2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="font-medium">No named links yet</p>
                <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
                  Create one for each person who edits this checklist. Then you can see who changed what.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {active.map((l) => (
                  <li key={l.id} className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        {renaming?.id === l.id ? (
                          <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void rename(l, renaming.value);
                            }}
                          >
                            <Input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ id: l.id, value: e.target.value })}
                              maxLength={80}
                              aria-label={`New name for ${l.name}`}
                              className="h-9"
                            />
                            <Button type="submit" size="sm" disabled={!renaming.value.trim() || busy === `rename-${l.id}`}>Save</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                          </form>
                        ) : (
                          <p className="truncate font-medium">
                            {l.name}
                            {isExpired(l) && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Expired</span>}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {l.lastUsedAt ? `Last opened ${formatDistanceToNow(l.lastUsedAt, { addSuffix: true })}` : "Has not opened it yet"}
                          {" · "}created {formatDistanceToNow(l.createdAt, { addSuffix: true })}
                          {l.expiresAt ? ` · ends ${l.expiresAt.slice(0, 10)}` : ""}
                        </p>
                      </div>
                      {renaming?.id !== l.id && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button size="sm" onClick={() => void copy(l)} className="h-9">
                            {copiedId === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedId === l.id ? "Copied" : "Copy link"}
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => setRenaming({ id: l.id, value: l.name })} aria-label={`Rename ${l.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmNew(l.id)} title="Same person and history, new address">
                            <RefreshCw className="h-3.5 w-3.5" />New address
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmOff(l.id)}>
                            Turn off
                          </Button>
                        </div>
                      )}
                    </div>

                    {confirmOff === l.id && (
                      <div role="alertdialog" aria-label={`Turn off ${l.name}'s link`} className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                        <p className="min-w-0 flex-1 text-sm">Turn off {l.name}&apos;s link? It stops working at once. Their past changes stay in the history.</p>
                        <Button size="sm" variant="destructive" disabled={busy === `off-${l.id}`} onClick={() => void turnOff(l)}>
                          {busy === `off-${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Yes, turn off
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmOff(null)}>Keep it</Button>
                      </div>
                    )}
                    {confirmNew === l.id && (
                      <div role="alertdialog" aria-label={`New address for ${l.name}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
                        <p className="min-w-0 flex-1 text-sm">Give {l.name} a new address? The old one stops working at once, so send them the new one.</p>
                        <Button size="sm" disabled={busy === `new-${l.id}`} onClick={() => void newAddress(l)}>
                          {busy === `new-${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Yes, new address
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmNew(null)}>Cancel</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {off.length > 0 && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer p-3 font-medium">Turned off ({off.length})</summary>
                <ul className="divide-y divide-border border-t border-border">
                  {off.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-muted-foreground">
                      <span className="font-medium text-foreground">{l.name}</span>
                      <span className="text-xs">turned off {l.revokedAt ? formatDistanceToNow(l.revokedAt, { addSuffix: true }) : ""}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="rounded-lg bg-secondary p-3 text-sm">
              <p className="font-medium">The original editor link still works</p>
              <p className="mt-1 text-muted-foreground">
                Anyone using it is recorded as &ldquo;Original shared link (unnamed)&rdquo;. Once everyone has their own link, use
                &ldquo;Regenerate original editor link&rdquo; on the checklist card to turn the original off.
              </p>
            </div>

            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/checklists/${checklistId}/history`}>
                  <History className="h-4 w-4" />
                  Open edit history
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
