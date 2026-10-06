"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ITEM_STATUS_LABELS, PRIORITIES, type ItemStatus } from "@/lib/tracker/constants";
import type { ContributorPayload } from "./ContributorView";
import { ClientActivityFeed } from "./ClientActivityFeed";
import { call, input, primary, problem, secondary } from "./contributor-client";
import { ItemStatusBadge } from "./badges";

/**
 * The panel a client contact uses to change one item, comment on it and see its history, or to add a new item.
 * The server decides what is allowed (contributor-service.ts); this only offers the fields that are.
 */

type Item = ContributorPayload["items"][number];

export type PanelTarget = string | "new" | null;

/** What a client may set. The server enforces the same list (CLIENT_STATUSES in contributor-validations.ts). */
const SETTABLE: ItemStatus[] = ["not_started", "in_progress", "waiting_on_client", "done"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export function ContributorItemPanel({
  token,
  data,
  target,
  onClose,
  reload,
  onAdded,
}: {
  token: string;
  data: ContributorPayload;
  target: PanelTarget;
  onClose: () => void;
  reload: () => Promise<void>;
  onAdded: () => void;
}) {
  const item = target && target !== "new" ? data.items.find((i) => i.id === target) : undefined;
  const open = target !== null;
  // Lives here, not in the form: the form is rebuilt after every save, which would wipe the message.
  const [savedFor, setSavedFor] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <div className="es-client rounded-lg bg-[var(--es-card)] p-5 text-[var(--es-ink)] sm:p-6">
          {target === "new" ? (
            <AddForm token={token} data={data} onClose={onClose} reload={reload} onAdded={onAdded} />
          ) : item ? (
            <>
              {savedFor === item.id && (
                <p role="status" className="mb-4 rounded-lg border border-[var(--es-line)] bg-[var(--es-stripe)] px-3 py-2 text-sm">
                  Saved. Talkpush can see this change.
                </p>
              )}
              <EditForm key={item.updatedAt} token={token} data={data} item={item} reload={reload} onSaved={() => setSavedFor(item.id)} onEdit={() => setSavedFor(null)} />
              <Comments key={`c-${item.id}-${data.comments.length}`} token={token} data={data} item={item} reload={reload} />
              <History token={token} item={item} version={`${item.updatedAt}-${data.comments.length}`} />
            </>
          ) : (
            <>
              <DialogTitle className="text-lg font-bold">This item is no longer available</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-[var(--es-muted)]">It may have been removed. Close this and look at the list again.</DialogDescription>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--es-muted)]">{hint}</p>}
    </div>
  );
}

function WaitsFor({ items, selfId, value, onChange, max }: { items: Item[]; selfId?: string; value: string[]; onChange: (next: string[]) => void; max: number }) {
  const titleOf = (id: string) => items.find((i) => i.id === id)?.title ?? "Item";
  const candidates = items.filter((i) => i.id !== selfId && i.status !== "dropped" && !value.includes(i.id));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((id) => (
            <li key={id} className="inline-flex items-center gap-2 rounded-full border border-[var(--es-line)] bg-[var(--es-stripe)] px-3 py-1 text-sm">
              {titleOf(id)}
              <button type="button" className="min-h-6 min-w-6 text-[var(--es-muted)]" aria-label={`Remove ${titleOf(id)}`} onClick={() => onChange(value.filter((w) => w !== id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && candidates.length > 0 && (
        <select aria-label="Choose an item it has to wait for" className={input} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">Choose an item</option>
          {candidates.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function EditForm({ token, data, item, reload, onSaved, onEdit }: { token: string; data: ContributorPayload; item: Item; reload: () => Promise<void>; onSaved: () => void; onEdit: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [status, setStatus] = useState(item.status);
  const [priority, setPriority] = useState(item.priority);
  const [startDate, setStartDate] = useState(item.startDate ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [owner, setOwner] = useState(item.ownerPersonId ?? "");
  const [waitsOn, setWaitsOn] = useState<string[]>(item.waitsOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const statusOptions: ItemStatus[] = item.canUpdate ? SETTABLE : [item.status as ItemStatus];
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  const changes: Record<string, unknown> = {};
  if (title.trim() !== item.title) changes.title = title.trim();
  if (description.trim() !== (item.description ?? "")) changes.description = description.trim();
  if (status !== item.status) changes.status = status;
  if (priority !== item.priority) changes.priority = priority;
  if (startDate !== (item.startDate ?? "")) changes.startDate = startDate || null;
  if (dueDate !== (item.dueDate ?? "")) changes.dueDate = dueDate || null;
  if (item.canChangeOwner && owner !== (item.ownerPersonId ?? "")) changes.ownerPersonId = owner || null;
  if (!sameList(waitsOn, item.waitsOn)) changes.waitsOn = waitsOn;
  const dirty = Object.keys(changes).length > 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dirty || !title.trim()) return;
    setBusy(true);
    setError("");
    onEdit();
    const r = await call(token, `/items/${encodeURIComponent(item.id)}`, "PATCH", { ...changes, expectedUpdatedAt: item.updatedAt });
    setBusy(false);
    if (!r.ok) {
      setError(problem(r.json));
      if (r.status === 409) await reload(); // show what the colleague changed
      return;
    }
    onSaved();
    await reload();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="pr-8">
        <DialogTitle className="sr-only">Edit {item.title}</DialogTitle>
        <DialogDescription className="sr-only">Change this item, add a comment, or see what has happened to it.</DialogDescription>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ItemStatusBadge status={item.status} />
          {item.addedByClient && <span className="text-xs text-[var(--es-muted)]">Added by your team</span>}
          {item.awaitingReview && <span className="text-xs text-[var(--es-muted)]">Waiting for Talkpush to review</span>}
        </div>
        <Field id="edit-title" label="What needs to happen">
          <input id="edit-title" className={`${input} text-base font-medium`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="edit-status" label="Status" hint={item.canUpdate ? undefined : "This item is on hold with Talkpush. Ask your Talkpush contact to change its status."}>
          <select id="edit-status" className={input} value={status} disabled={!item.canUpdate} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {ITEM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="edit-priority" label="How important is it">
          <select id="edit-priority" className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {cap(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="edit-start" label="Start date">
          <input id="edit-start" type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field id="edit-due" label="Due date">
          <input id="edit-due" type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <Field id="edit-owner" label="Who is looking after it" hint={item.canChangeOwner ? undefined : `${item.ownerName ?? "Talkpush"} is looking after this one. Ask your Talkpush contact to reassign it.`}>
        {item.canChangeOwner ? (
          <select id="edit-owner" className={input} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">No owner yet</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === data.you.id ? " (you)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <input id="edit-owner" className={input} value={item.ownerName ?? "Talkpush"} disabled readOnly />
        )}
      </Field>

      <Field id="edit-description" label="More detail">
        <textarea id="edit-description" className={input} rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">It has to wait for</p>
        <WaitsFor items={data.items} selfId={item.id} value={waitsOn} onChange={setWaitsOn} max={data.limits.maxWaitsOn} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--es-red)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primary} disabled={busy || !dirty || !title.trim()}>
          {busy ? "Saving" : "Save changes"}
        </button>
        {!dirty && <span className="text-xs text-[var(--es-muted)]">Change something to save it.</span>}
      </div>
    </form>
  );
}

function Comments({ token, data, item, reload }: { token: string; data: ContributorPayload; item: Item; reload: () => Promise<void> }) {
  const thread = data.comments.filter((c) => c.itemId === item.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const r = await call(token, `/items/${encodeURIComponent(item.id)}/remarks`, "POST", { body: text.trim() });
    setBusy(false);
    if (!r.ok) return setError(problem(r.json));
    setText("");
    await reload();
  };

  return (
    <section aria-labelledby="comments-title" className="mt-6 border-t border-[var(--es-line)] pt-5">
      <h3 id="comments-title" className="text-sm font-bold">
        Comments
      </h3>
      {thread.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--es-muted)]">No comments yet. Anyone with a link, and the Talkpush team, can read what you write here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {thread.map((c) => (
            <li key={c.id} className="rounded-lg border border-[var(--es-line)] bg-[var(--es-stripe)] p-3 text-sm">
              <p className="text-xs text-[var(--es-muted)]">
                <span className="font-semibold text-[var(--es-ink)]">{c.author}</span>
                {c.side === "talkpush" ? "" : " · Client"} · {time.format(new Date(c.createdAt)).toLowerCase()}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="mt-3 space-y-2">
        <label htmlFor="new-comment" className="text-sm font-medium">
          Add a comment
        </label>
        <textarea id="new-comment" className={input} rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-[var(--es-red)]">
            {error}
          </p>
        )}
        <button type="submit" className={secondary} disabled={busy || !text.trim()}>
          {busy ? "Sending" : "Add comment"}
        </button>
      </form>
    </section>
  );
}

function History({ token, item, version }: { token: string; item: Item; version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-6 border-t border-[var(--es-line)] pt-4" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="min-h-8 cursor-pointer text-sm font-bold">History of this item</summary>
      {open && (
        <div className="mt-3">
          <ClientActivityFeed key={version} url={`/api/contribute/${encodeURIComponent(token)}/activity?item=${encodeURIComponent(item.id)}`} emptyText="No changes yet." />
        </div>
      )}
    </details>
  );
}

function AddForm({ token, data, onClose, reload, onAdded }: { token: string; data: ContributorPayload; onClose: () => void; reload: () => Promise<void>; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [waitsOn, setWaitsOn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const r = await call(token, "/items", "POST", { title, description, priority, dueDate: dueDate || null, waitsOn });
    setBusy(false);
    if (!r.ok) return setError(problem(r.json));
    onAdded();
    await reload();
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="pr-8">
        <DialogTitle className="text-lg font-bold">Add an item</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[var(--es-muted)]">Something we have missed, or something you need from us. Talkpush will review it.</DialogDescription>
      </div>
      <Field id="add-title-input" label="What needs to happen">
        <input id="add-title-input" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus />
      </Field>
      <Field id="add-description" label="More detail (optional)">
        <textarea id="add-description" className={input} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="add-priority" label="How important is it">
          <select id="add-priority" className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {cap(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="add-due" label="Target date (optional)">
          <input id="add-due" type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">It has to wait for (optional)</p>
        <WaitsFor items={data.items.filter((i) => i.status !== "done")} value={waitsOn} onChange={setWaitsOn} max={data.limits.maxWaitsOn} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--es-red)]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primary} disabled={busy || !title.trim()}>
          {busy ? "Adding" : "Add item"}
        </button>
        <button type="button" className={secondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

