"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/workflow/ui/toast";
import { formatDistanceToNow } from "@/lib/workflow/dates";
import type { AccessOverview, LinkSummary, MemberSummary } from "@/lib/workflow/access/links-service";

/**
 * Who can open this workflow, like the Share box in Google Drive:
 * named people (a personal link each), the three shared links (view / comment / edit), what clients see
 * (published version or live), and "Preview as". Links are copied, never emailed.
 *
 * For safety a secret link is shown only at the moment it is created. To copy one again, get a new one;
 * the old address then stops working.
 */

type Level = "view" | "comment" | "edit";

const LEVELS: { level: Level; title: string; caption: string }[] = [
  { level: "view", title: "View link", caption: "Anyone with this link can look, but not change or comment." },
  { level: "comment", title: "Comment link", caption: "Anyone with this link can look and leave comments. They give their name first." },
  { level: "edit", title: "Edit link", caption: "Anyone with this link can change the diagram. Safest as suggest-only, so you accept each change." },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied. Paste it into your email.");
  } catch {
    toast.error("Could not copy. Select the link and copy it by hand.");
  }
}

export default function ShareDialog({
  workflowId,
  open,
  onOpenChange,
  legacyLinkActive,
  onStopLegacyLink,
}: {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The older single share link, if this workflow still has one. */
  legacyLinkActive: boolean;
  onStopLegacyLink: () => void;
}) {
  const [data, setData] = useState<AccessOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Secret links revealed in this session: key -> address.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState({ name: "", email: "", level: "viewer" as "viewer" | "commenter" | "editor" });
  const [showInvite, setShowInvite] = useState(false);
  const [passcodeFor, setPasscodeFor] = useState<Level | null>(null);
  const [passcode, setPasscode] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<AccessOverview>(`/api/workflows/${workflowId}/access`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sharing settings.");
    }
  }, [workflowId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const linkOf = (level: Level): LinkSummary | undefined => data?.links.find((l) => l.level === level);

  async function createLink(level: Level, extra: Record<string, unknown> = {}) {
    const created = await run(`link-${level}`, () => api<{ url: string }>(`/api/workflows/${workflowId}/links`, json("POST", { level, ...extra })));
    if (!created) return;
    setRevealed((r) => ({ ...r, [`link-${level}`]: created.url }));
    await load();
    await copyText(created.url);
  }

  async function patchLink(link: LinkSummary, patch: Record<string, unknown>) {
    await run(`link-${link.level}`, () => api(`/api/workflows/${workflowId}/links/${link.id}`, json("PATCH", patch)));
    await load();
  }

  async function turnOffLink(link: LinkSummary) {
    await run(`link-${link.level}`, () => api(`/api/workflows/${workflowId}/links/${link.id}`, json("DELETE")));
    setRevealed((r) => {
      const next = { ...r };
      delete next[`link-${link.level}`];
      return next;
    });
    await load();
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    const created = await run("invite", () =>
      api<{ id: string; url: string }>(`/api/workflows/${workflowId}/members`, json("POST", { displayName: invite.name, email: invite.email || undefined, level: invite.level }))
    );
    if (!created) return;
    setRevealed((r) => ({ ...r, [`member-${created.id}`]: created.url }));
    setInvite({ name: "", email: "", level: "viewer" });
    setShowInvite(false);
    await load();
    await copyText(created.url);
  }

  async function patchMember(m: MemberSummary, patch: Record<string, unknown>) {
    await run(`member-${m.id}`, () => api(`/api/workflows/${workflowId}/members/${m.id}`, json("PATCH", patch)));
    await load();
  }

  async function newMemberLink(m: MemberSummary) {
    const r = await run(`member-${m.id}`, () => api<{ url: string }>(`/api/workflows/${workflowId}/members/${m.id}`, json("POST")));
    if (!r) return;
    setRevealed((x) => ({ ...x, [`member-${m.id}`]: r.url }));
    await copyText(r.url);
  }

  async function removeMember(m: MemberSummary) {
    if (!window.confirm(`Remove ${m.displayName}? Their link stops working.`)) return;
    await run(`member-${m.id}`, () => api(`/api/workflows/${workflowId}/members/${m.id}`, json("DELETE")));
    await load();
  }

  async function setGeneral(generalAccess: "restricted" | "anyone_with_link") {
    await run("general", () => api(`/api/workflows/${workflowId}/access`, json("PUT", { generalAccess })));
    await load();
  }

  async function setFeasibility(showFeasibility: boolean) {
    await run("feas", () => api(`/api/workflows/${workflowId}/access`, json("PUT", { showFeasibility })));
    await load();
  }

  async function publish() {
    const r = await run("publish", () => api<{ version: { versionNumber: number } }>(`/api/workflows/${workflowId}/publish`, json("POST", {})));
    if (r) toast.success(`Version ${r.version.versionNumber} published. Clients now see it.`);
    await load();
  }

  async function showLive() {
    await run("publish", () => api(`/api/workflows/${workflowId}/publish`, json("DELETE")));
    await load();
  }

  const expiryValue = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share this workflow</DialogTitle>
          <DialogDescription>Copy a link and paste it into your own email or chat. Nothing is sent from here, and clients never need an account.</DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {!data && !error && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" /></div>}

        {data && (
          <div className="space-y-7 text-sm">
            {/* 1. people */}
            <section aria-labelledby="share-people">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="share-people" className="font-semibold text-foreground">People with access</h3>
                <Button size="sm" variant="outline" onClick={() => setShowInvite((v) => !v)}><UserPlus className="h-3.5 w-3.5" />Invite a person</Button>
              </div>
              {showInvite && (
                <form onSubmit={inviteMember} className="mb-3 grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <Input placeholder="Name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} required maxLength={80} aria-label="Name" />
                  <Input type="email" placeholder="Email (optional, only a label)" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} aria-label="Email" />
                  <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={invite.level} onChange={(e) => setInvite({ ...invite, level: e.target.value as typeof invite.level })} aria-label="Access level">
                    <option value="viewer">Viewer</option>
                    <option value="commenter">Commenter</option>
                    <option value="editor">Editor</option>
                  </select>
                  <Button type="submit" disabled={busy === "invite" || !invite.name.trim()}>{busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Create link</Button>
                </form>
              )}
              <ul className="divide-y divide-border rounded-lg border border-border">
                <li className="flex items-center justify-between gap-3 p-3">
                  <span className="font-medium">You</span>
                  <span className="text-muted-foreground">Owner</span>
                </li>
                {data.members.map((m) => {
                  const url = revealed[`member-${m.id}`];
                  return (
                    <li key={m.id} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{m.displayName}{m.email ? <span className="font-normal text-muted-foreground"> · {m.email}</span> : null}</p>
                          <p className="text-xs text-muted-foreground">{m.lastSeenAt ? `Last opened ${formatDistanceToNow(m.lastSeenAt, { addSuffix: true })}` : "Has not opened it yet"}{m.expiresAt ? ` · expires ${expiryValue(m.expiresAt)}` : ""}</p>
                        </div>
                        <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={m.level} onChange={(e) => patchMember(m, { level: e.target.value })} aria-label={`Access level for ${m.displayName}`}>
                          <option value="viewer">Viewer</option>
                          <option value="commenter">Commenter</option>
                          <option value="editor">Editor</option>
                        </select>
                        {url ? (
                          <Button size="sm" onClick={() => copyText(url)}><Copy className="h-3.5 w-3.5" />Copy link</Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={busy === `member-${m.id}`} onClick={() => newMemberLink(m)} title="Their old link stops working">Get a new link</Button>
                        )}
                        <Button size="icon-sm" variant="ghost" onClick={() => removeMember(m)} aria-label={`Remove ${m.displayName}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {m.level === "editor" && (
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={m.editMode === "suggest_only"} onChange={(e) => patchMember(m, { editMode: e.target.checked ? "suggest_only" : "direct" })} />Suggest-only (you accept each change)</label>
                        )}
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={m.canApprove} onChange={(e) => patchMember(m, { canApprove: e.target.checked })} />Can approve</label>
                        {m.level === "viewer" && (
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={m.canComment} onChange={(e) => patchMember(m, { canComment: e.target.checked })} />Can comment</label>
                        )}
                        {m.level === "editor" && m.editMode === "direct" && (
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={m.canAcceptSuggestions} onChange={(e) => patchMember(m, { canAcceptSuggestions: e.target.checked })} />Can accept others&apos; suggestions</label>
                        )}
                      </div>
                      {url && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`Link for ${m.displayName}`} className="w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs" />}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 2. general access */}
            <section aria-labelledby="share-general">
              <h3 id="share-general" className="mb-2 font-semibold text-foreground">General access</h3>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="General access">
                {([["restricted", "Restricted", "Only people you invited by name"], ["anyone_with_link", "Anyone with a link", "The shared links below work"]] as const).map(([value, title, hint]) => (
                  <label key={value} className={`flex min-w-52 flex-1 cursor-pointer items-start gap-2 rounded-lg border p-3 ${data.generalAccess === value ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="general-access" className="mt-1" checked={data.generalAccess === value} onChange={() => setGeneral(value)} />
                    <span><span className="block font-medium">{title}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                  </label>
                ))}
              </div>

              <ul className={`mt-3 space-y-3 ${data.generalAccess === "anyone_with_link" ? "" : "opacity-60"}`}>
                {LEVELS.map(({ level, title, caption }) => {
                  const link = linkOf(level);
                  const url = revealed[`link-${level}`];
                  return (
                    <li key={level} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{title}{link ? <span className="ml-2 rounded-full bg-brand-sage/25 px-2 py-0.5 text-[11px] font-semibold text-foreground">On</span> : <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Off</span>}</p>
                          <p className="text-xs text-muted-foreground">{caption}</p>
                        </div>
                        {!link ? (
                          <Button size="sm" disabled={busy === `link-${level}`} onClick={() => createLink(level)}><Link2 className="h-3.5 w-3.5" />Create link</Button>
                        ) : (
                          <>
                            {url ? (
                              <Button size="sm" onClick={() => copyText(url)}><Copy className="h-3.5 w-3.5" />Copy link</Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy === `link-${level}`} onClick={() => createLink(level, { editMode: link.editMode, canApprove: link.canApprove })} title="The old link stops working">Get a new link</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => turnOffLink(link)}>Turn off</Button>
                          </>
                        )}
                      </div>
                      {link && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                          {level === "edit" && (
                            <label className="flex items-center gap-1.5">Mode
                              <select className="h-7 rounded-md border border-input bg-background px-1.5" value={link.editMode} onChange={(e) => patchLink(link, { editMode: e.target.value })}>
                                <option value="suggest_only">Suggest-only</option>
                                <option value="direct">Direct editing</option>
                              </select>
                            </label>
                          )}
                          <label className="flex items-center gap-1.5"><input type="checkbox" checked={link.canApprove} onChange={(e) => patchLink(link, { canApprove: e.target.checked })} />Can approve</label>
                          <label className="flex items-center gap-1.5">Expires
                            <input type="date" className="h-7 rounded-md border border-input bg-background px-1.5" value={expiryValue(link.expiresAt)} onChange={(e) => patchLink(link, { expiresAt: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })} />
                          </label>
                          {link.hasPasscode ? (
                            <span className="flex items-center gap-2">Passcode on <button type="button" className="underline" onClick={() => patchLink(link, { passcode: null })}>remove</button></span>
                          ) : passcodeFor === level ? (
                            <form className="flex items-center gap-1.5" onSubmit={async (e) => { e.preventDefault(); await patchLink(link, { passcode }); setPasscodeFor(null); setPasscode(""); }}>
                              <input className="h-7 w-32 rounded-md border border-input bg-background px-1.5" placeholder="4+ characters" value={passcode} onChange={(e) => setPasscode(e.target.value)} minLength={4} maxLength={64} aria-label="New passcode" autoFocus />
                              <Button size="xs" type="submit" disabled={passcode.length < 4}>Set</Button>
                            </form>
                          ) : (
                            <button type="button" className="underline" onClick={() => setPasscodeFor(level)}>Add a passcode</button>
                          )}
                          {link.lastUsedAt && <span className="text-muted-foreground">Last used {formatDistanceToNow(link.lastUsedAt, { addSuffix: true })}</span>}
                        </div>
                      )}
                      {url && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={`${title} address`} className="mt-2 w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs" />}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">For safety a link is shown only when it is created. To copy one again, get a new one; the old one then stops working.</p>
              {legacyLinkActive && (
                <p className="mt-2 rounded-md bg-brand-amber/15 p-2 text-xs text-foreground">
                  This workflow also has an older single share link that still works for anyone who has it.{" "}
                  <button type="button" className="font-medium underline" onClick={onStopLegacyLink}>Turn it off</button>
                </p>
              )}
            </section>

            {/* 3. what clients see */}
            <section aria-labelledby="share-see">
              <h3 id="share-see" className="mb-2 font-semibold text-foreground">What clients see</h3>
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p>
                  {data.publishedVersionId ? <>A <strong>published version</strong> (a frozen copy). Your later edits do not show until you publish again.</> : <>The <strong>live</strong> workflow. Clients see your latest saved changes.</>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={publish} disabled={busy === "publish"}>{busy === "publish" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{data.publishedVersionId ? "Publish a new version" : "Publish this version"}</Button>
                  {data.publishedVersionId && <Button size="sm" variant="outline" onClick={showLive} disabled={busy === "publish"}>Show live instead</Button>}
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={data.showFeasibility} onChange={(e) => setFeasibility(e.target.checked)} />Show feasibility to clients (hidden by default)</label>
              </div>
            </section>

            {/* 4. preview */}
            <section aria-labelledby="share-preview">
              <h3 id="share-preview" className="mb-2 font-semibold text-foreground">Preview as</h3>
              <p className="mb-2 text-xs text-muted-foreground">Open the real client page the way each kind of person sees it. Check that nothing internal shows. Nothing you do there is saved.</p>
              <div className="flex flex-wrap gap-2">
                {([["viewer", "Viewer"], ["commenter", "Commenter"], ["editor-direct", "Editor (editing)"], ["editor-suggesting", "Editor (suggesting)"]] as const).map(([mode, label]) => (
                  <Button key={mode} size="sm" variant="outline" asChild>
                    <a href={`/admin/workflows/${workflowId}/preview/${mode}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{label}</a>
                  </Button>
                ))}
              </div>
            </section>

            <div className="flex justify-end border-t border-border pt-3">
              <Button onClick={() => onOpenChange(false)}><Check className="h-4 w-4" />Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
