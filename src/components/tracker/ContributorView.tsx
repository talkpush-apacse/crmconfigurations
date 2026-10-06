"use client";

import { useCallback, useEffect, useState } from "react";
import { ITEM_STATUS_LABELS, PRIORITIES } from "@/lib/tracker/constants";
import type { ClientView } from "@/lib/tracker/client-view";
import type { getContributorView } from "@/lib/tracker/contributor-service";
import { formatDate } from "@/lib/tracker/format";
import { ClientDownloadButton } from "./ClientDownloadButton";
import { ExecSummary } from "./ExecSummary";
import { ItemStatusBadge } from "./badges";

type Payload = Omit<Awaited<ReturnType<typeof getContributorView>>, "view"> & { view: ClientView };
type Item = Payload["items"][number];
type State = { kind: "loading" } | { kind: "ready"; data: Payload } | { kind: "unavailable" } | { kind: "busy" };

const SETTABLE = ["in_progress", "waiting_on_client", "done"] as const;

const card = "rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-4";
const input = "min-h-11 w-full rounded-md border border-[var(--es-line)] bg-white px-3 py-2 text-sm text-[var(--es-ink)]";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--es-ink)] px-4 text-sm font-medium text-white disabled:opacity-50";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--es-line)] bg-[var(--es-card)] px-4 text-sm font-medium text-[var(--es-ink)] disabled:opacity-50";

/** Every call carries the secret link in the path. No cookies, no referrer. */
async function call(token: string, path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`/api/contribute/${encodeURIComponent(token)}${path}`, {
    method,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // empty body
  }
  return { ok: res.ok, status: res.status, json };
}

function problem(json: Record<string, unknown>): string {
  const issues = Array.isArray(json.issues) ? (json.issues as { path: string; message: string }[]) : [];
  const detail = issues.map((i) => i.message).join(". ");
  const base = typeof json.error === "string" ? json.error : "Something went wrong. Please try again.";
  return detail ? `${base} ${detail}` : base;
}

async function fetchState(token: string): Promise<State> {
  try {
    const r = await call(token, "", "GET");
    if (r.status === 429) return { kind: "busy" };
    if (!r.ok) return { kind: "unavailable" };
    return { kind: "ready", data: r.json as unknown as Payload };
  } catch {
    return { kind: "unavailable" };
  }
}

export function ContributorView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  // Called after a change so the page shows what is now true.
  const load = useCallback(async () => {
    setState(await fetchState(token));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void fetchState(token).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="es-client min-h-screen">
      <header className="border-b border-[var(--es-line)] bg-[var(--es-card)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-8">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[-0.03em] text-[var(--es-ink)]">Talkpush</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {state.kind === "loading" && (
          <div className="flex justify-center py-24" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--es-ink)] border-t-transparent" aria-hidden="true" />
            <span className="sr-only">Loading your project</span>
          </div>
        )}
        {state.kind === "unavailable" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">This link is not available</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">It may have expired or been replaced. Please ask your Talkpush contact for a new link.</p>
          </div>
        )}
        {state.kind === "busy" && (
          <div className="mx-auto max-w-md rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)] p-8 text-center" role="alert">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Please try again in a few minutes</h1>
            <p className="mt-2 text-sm text-[var(--es-muted)]">There have been a lot of requests from your connection.</p>
          </div>
        )}
        {state.kind === "ready" && <Ready token={token} data={state.data} reload={load} />}
      </main>
    </div>
  );
}

function Ready({ token, data, reload }: { token: string; data: Payload; reload: () => Promise<void> }) {
  const mine = data.items.filter((i) => i.mine);
  const others = data.items.filter((i) => !i.mine);
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">Hello {data.you.name}</h1>
          <p className="mt-1 text-sm text-[var(--es-muted)]">Here is where the project stands, the items that are yours, and a place to add anything we have missed.</p>
        </div>
        <ClientDownloadButton url={`/api/contribute/${encodeURIComponent(token)}/export`} />
      </div>

      <ExecSummary data={data.view} context="client" embedded />

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">
          Your items
        </h2>
        {mine.length === 0 ? (
          <p className="mt-3 rounded-[10px] border border-dashed border-[var(--es-line)] bg-[var(--es-card)] px-4 py-6 text-center text-sm text-[var(--es-muted)]">
            Nothing is assigned to you yet. You can add an item below.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.map((item) => (
              <MyItem key={item.id} token={token} item={item} reload={reload} />
            ))}
          </ul>
        )}
      </section>

      <AddItem token={token} items={data.items} maxWaitsOn={data.limits.maxWaitsOn} reload={reload} />

      <section aria-labelledby="others-title">
        <h2 id="others-title" className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">
          Everything else in the project
        </h2>
        <ul className="mt-3 divide-y divide-[var(--es-line)] overflow-hidden rounded-[10px] border border-[var(--es-line)] bg-[var(--es-card)]">
          {others.map((item, idx) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={idx % 2 ? { background: "var(--es-stripe)" } : undefined}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-[var(--es-muted)]">
                  {item.ownerName ?? "No owner yet"}
                  {item.dueDate ? `. Due ${formatDate(item.dueDate)}` : ""}
                  {item.awaitingReview ? ". Waiting for Talkpush to review" : ""}
                </p>
              </div>
              <ItemStatusBadge status={item.status} />
            </li>
          ))}
          {others.length === 0 && <li className="px-4 py-6 text-center text-sm text-[var(--es-muted)]">No other items yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function MyItem({ token, item, reload }: { token: string; item: Item; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const setStatus = async (status: string) => {
    setBusy(true);
    setError("");
    const r = await call(token, `/items/${encodeURIComponent(item.id)}`, "PATCH", { status });
    setBusy(false);
    if (!r.ok) return setError(problem(r.json));
    await reload();
  };

  const sendNote = async () => {
    setBusy(true);
    setError("");
    const r = await call(token, `/items/${encodeURIComponent(item.id)}/remarks`, "POST", { body: note });
    setBusy(false);
    if (!r.ok) return setError(problem(r.json));
    setNote("");
    setSent(true);
    setNoteOpen(false);
  };

  return (
    <li className={card}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-[var(--es-ink)]">{item.title}</p>
          {item.description && <p className="mt-1 text-sm text-[var(--es-muted)]">{item.description}</p>}
          <p className="mt-1 text-xs text-[var(--es-muted)]">
            {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date"}
            {item.awaitingReview ? ". Waiting for Talkpush to review" : ""}
          </p>
        </div>
        <ItemStatusBadge status={item.status} />
      </div>

      {item.canUpdate ? (
        <div className="mt-3 space-y-3">
          <div role="group" aria-label={`Update the status of ${item.title}`} className="flex flex-wrap gap-2">
            {SETTABLE.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                aria-pressed={item.status === s}
                onClick={() => item.status !== s && setStatus(s)}
                className={item.status === s ? primary : secondary}
              >
                {ITEM_STATUS_LABELS[s]}
              </button>
            ))}
            <button type="button" className={secondary} onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen}>
              Add a note
            </button>
          </div>
          {noteOpen && (
            <div className="space-y-2">
              <label htmlFor={`note-${item.id}`} className="text-sm font-medium">
                Note for Talkpush
              </label>
              <textarea id={`note-${item.id}`} className={input} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="button" className={primary} disabled={busy || !note.trim()} onClick={sendNote}>
                Send note
              </button>
            </div>
          )}
          {sent && <p role="status" className="text-sm text-[var(--es-muted)]">Note sent to Talkpush.</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--es-muted)]">Talkpush is looking after this one. Ask your Talkpush contact if you need a change.</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--es-red)]">
          {error}
        </p>
      )}
    </li>
  );
}

function AddItem({ token, items, maxWaitsOn, reload }: { token: string; items: Item[]; maxWaitsOn: number; reload: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [waitsOn, setWaitsOn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const candidates = items.filter((i) => i.status !== "done" && i.status !== "dropped" && !waitsOn.includes(i.id));
  const titleOf = (id: string) => items.find((i) => i.id === id)?.title ?? "Item";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);
    const r = await call(token, "/items", "POST", { title, description, priority, dueDate: dueDate || null, waitsOn });
    setBusy(false);
    if (!r.ok) return setError(problem(r.json));
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setWaitsOn([]);
    setDone(true);
    await reload();
  };

  return (
    <section aria-labelledby="add-title">
      <h2 id="add-title" className="text-xl font-bold tracking-[-0.03em] text-[var(--es-ink)]">
        Add an item
      </h2>
      <p className="mt-1 text-sm text-[var(--es-muted)]">Something we have missed, or something you need from us. Talkpush will review it.</p>
      <form onSubmit={submit} className={`${card} mt-3 space-y-4`}>
        <div className="space-y-1.5">
          <label htmlFor="add-title-input" className="text-sm font-medium">
            What needs to happen
          </label>
          <input id="add-title-input" className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="add-description" className="text-sm font-medium">
            More detail (optional)
          </label>
          <textarea id="add-description" className={input} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="add-priority" className="text-sm font-medium">
              How important is it
            </label>
            <select id="add-priority" className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-due" className="text-sm font-medium">
              Target date (optional)
            </label>
            <input id="add-due" type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="add-waits" className="text-sm font-medium">
            It has to wait for (optional)
          </label>
          {waitsOn.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {waitsOn.map((id) => (
                <li key={id} className="inline-flex items-center gap-2 rounded-full border border-[var(--es-line)] bg-[var(--es-stripe)] px-3 py-1 text-sm">
                  {titleOf(id)}
                  <button type="button" className="min-h-6 min-w-6 text-[var(--es-muted)]" aria-label={`Remove ${titleOf(id)}`} onClick={() => setWaitsOn(waitsOn.filter((w) => w !== id))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {waitsOn.length < maxWaitsOn && candidates.length > 0 && (
            <select id="add-waits" className={input} value="" onChange={(e) => e.target.value && setWaitsOn([...waitsOn, e.target.value])}>
              <option value="">Choose an item</option>
              {candidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--es-red)]">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-sm text-[var(--es-muted)]">
            Added. It shows in &quot;Your items&quot; and Talkpush will review it.
          </p>
        )}
        <button type="submit" className={primary} disabled={busy || !title.trim()}>
          {busy ? "Adding" : "Add item"}
        </button>
      </form>
    </section>
  );
}
