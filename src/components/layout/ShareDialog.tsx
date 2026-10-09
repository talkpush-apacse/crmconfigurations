"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, Loader2, Pencil, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { getTabBySlug } from "@/lib/tab-config";

/**
 * "Share this page": the two links staff hand out for the tab they are on.
 *  - Can view: a read-only address. Staff turn it on, can give it a new address, or turn it off.
 *  - Can edit: the checklist's editor address. People who need their own name in the edit history get a named link.
 * Both open the same tab as the one on screen. Nothing is emailed from here: copy, then paste into your own email.
 */

export interface ShareTab {
  slug: string;
  label: string;
  /** Who fills the tab in. Talkpush-filled tabs are not part of the read-only view. */
  filledBy?: "talkpush" | "client";
}

type Busy = "load" | "enable" | "regenerate" | "turn_off" | null;
type Row = "view" | "edit";

async function viewLinkApi(checklistId: string, init?: RequestInit): Promise<{ token: string | null }> {
  const res = await fetch(`/api/checklists/${checklistId}/view-link`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return { token: body.token ?? null };
}

export function ShareDialog({
  open,
  onOpenChange,
  checklistId,
  clientName,
  editorToken,
  tab,
  onOpenNamedLinks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  clientName: string;
  editorToken: string;
  tab: ShareTab | null;
  onOpenNamedLinks: () => void;
}) {
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<Busy>("load");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Row | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"regenerate" | "turn_off" | null>(null);
  const resetCopied = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetCopied.current) clearTimeout(resetCopied.current);
  }, []);

  // Always ask the server when the dialog opens: another staff member may have turned the link off or changed it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(false);
    setBusy("load");
    setError(null);
    setNotice(null);
    setConfirm(null);
    viewLinkApi(checklistId)
      .then((r) => {
        if (!cancelled) setViewToken(r.token);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the view link.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
          setBusy(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, checklistId]);

  // The same tab on both links, unless the tab is not part of that link: then it opens the start page.
  const meta = tab ? getTabBySlug(tab.slug) : undefined;
  const editSlug = tab && !meta?.adminOnly ? tab.slug : "welcome";
  const viewable = !!tab && !meta?.adminOnly && tab.filledBy !== "talkpush";
  const viewSlug = viewable && tab ? tab.slug : "welcome";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const editUrl = `${origin}/editor/${editorToken}/${editSlug}`;
  const viewUrl = viewToken ? `${origin}/view/${viewToken}/${viewSlug}` : null;

  const copy = useCallback(async (row: Row, url: string) => {
    const ok = await copyToClipboard(url);
    setNotice(ok ? "Link copied. Paste it into your email." : "Could not copy. Select the link below and copy it by hand.");
    if (ok) {
      setCopied(row);
      if (resetCopied.current) clearTimeout(resetCopied.current);
      resetCopied.current = setTimeout(() => setCopied(null), 2500);
    }
  }, []);

  async function change(action: "enable" | "regenerate" | "turn_off") {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const r = await viewLinkApi(checklistId, { method: "POST", body: JSON.stringify({ action }) });
      setViewToken(r.token);
      setConfirm(null);
      if (action === "turn_off") {
        setNotice("The view link is off. The old address no longer works.");
      } else if (r.token) {
        const url = `${window.location.origin}/view/${r.token}/${viewSlug}`;
        await copy("view", url);
        if (action === "regenerate") setNotice("New view link copied. The old address no longer works.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const where = tab ? tab.label : "the start page";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {clientName}</DialogTitle>
          <DialogDescription>
            Both links open <span className="font-medium text-foreground">{where}</span>. Copy one and paste it into your own
            email; nothing is sent from here.
          </DialogDescription>
        </DialogHeader>

        <p role="status" aria-live="polite" className={notice ? "rounded-md bg-muted p-3 text-sm text-foreground" : "sr-only"}>
          {notice ?? ""}
        </p>
        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3 text-sm">
          {/* Can view */}
          <section className="rounded-lg border border-border p-3" aria-labelledby="share-view-title">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 id="share-view-title" className="font-semibold">Can view</h3>
                <p className="mt-0.5 text-muted-foreground">They can read everything the client sees, and change nothing.</p>
                {tab && !viewable && (
                  <p className="mt-1 text-muted-foreground">
                    {tab.label} is filled in by Talkpush, so this link opens the start page.
                  </p>
                )}
              </div>
              {!loaded ? (
                <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />
              ) : viewUrl ? (
                <Button size="sm" onClick={() => void copy("view", viewUrl)} className="h-11 shrink-0 md:h-9">
                  {copied === "view" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "view" ? "Copied" : "Copy link"}
                </Button>
              ) : (
                <Button size="sm" disabled={busy !== null} onClick={() => void change("enable")} className="h-11 shrink-0 md:h-9">
                  {busy === "enable" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Create and copy
                </Button>
              )}
            </div>

            {viewUrl && (
              <>
                <input
                  readOnly
                  value={viewUrl}
                  aria-label="View link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 w-full truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" className="max-md:min-h-11" disabled={busy !== null} onClick={() => setConfirm("regenerate")} title="Same checklist, new address. The old one stops working.">
                    <RefreshCw className="h-3.5 w-3.5" />
                    New address
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy !== null} className="text-destructive hover:text-destructive max-md:min-h-11" onClick={() => setConfirm("turn_off")}>
                    Turn off
                  </Button>
                </div>
              </>
            )}
            {!viewUrl && loaded && (
              <p className="mt-2 text-muted-foreground">The view link is off. Create one when you need to share a read-only copy.</p>
            )}

            {confirm === "turn_off" && (
              <div role="alertdialog" aria-label="Turn off the view link" className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                <p className="min-w-0 flex-1">Turn off the view link? It stops working at once for everyone who has it.</p>
                <Button size="sm" variant="destructive" disabled={busy === "turn_off"} onClick={() => void change("turn_off")}>
                  {busy === "turn_off" && <Loader2 className="h-4 w-4 animate-spin" />}Yes, turn off
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Keep it</Button>
              </div>
            )}
            {confirm === "regenerate" && (
              <div role="alertdialog" aria-label="New view address" className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
                <p className="min-w-0 flex-1">Make a new address? The old one stops working at once, so send the new one.</p>
                <Button size="sm" disabled={busy === "regenerate"} onClick={() => void change("regenerate")}>
                  {busy === "regenerate" && <Loader2 className="h-4 w-4 animate-spin" />}Yes, new address
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              </div>
            )}
          </section>

          {/* Can edit */}
          <section className="rounded-lg border border-border p-3" aria-labelledby="share-edit-title">
            <div className="flex items-start gap-3">
              <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 id="share-edit-title" className="font-semibold">Can edit</h3>
                <p className="mt-0.5 text-muted-foreground">
                  They can change the checklist. In the edit history their changes show as &ldquo;Original shared link&rdquo;.
                </p>
              </div>
              <Button size="sm" onClick={() => void copy("edit", editUrl)} className="h-11 shrink-0 md:h-9">
                {copied === "edit" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "edit" ? "Copied" : "Copy link"}
              </Button>
            </div>
            <input
              readOnly
              value={editUrl}
              aria-label="Edit link"
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
            />
            <div className="mt-2">
              <Button
                size="sm"
                variant="ghost"
                className="max-md:min-h-11"
                onClick={() => {
                  onOpenChange(false);
                  onOpenNamedLinks();
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Give someone their own edit link
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
