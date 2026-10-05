"use client";

import { useState } from "react";
import { KeyRound, LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiProblem, ClientApi } from "./api";

/**
 * The friendly page for a link that does not work (turned off, expired, mistyped) or that needs a passcode.
 * "Request access" sends a note to the person who shared it; nothing is emailed.
 */
export default function ProblemPage({
  problem,
  api,
  onPasscode,
}: {
  problem: ApiProblem;
  api: ClientApi;
  onPasscode: (passcode: string) => void;
}) {
  const askPasscode = problem.problem === "passcode_required" || problem.problem === "wrong_passcode";
  const [passcode, setPasscode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.requestAccess({ name, email: email || undefined, message: message || undefined });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-foreground">
          {askPasscode ? <KeyRound className="h-5 w-5" aria-hidden /> : <LinkIcon className="h-5 w-5" aria-hidden />}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{problem.title ?? problem.error}</h1>
        {problem.clientName && <p className="mt-1 text-sm text-muted-foreground">{problem.clientName}</p>}
        <p className="mt-3 text-sm text-muted-foreground">{problem.message}</p>

        {askPasscode && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (passcode.trim()) onPasscode(passcode.trim());
            }}
          >
            <label className="block text-sm font-medium text-foreground" htmlFor="wf-passcode">Passcode</label>
            <Input id="wf-passcode" type="password" autoComplete="off" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
            <Button type="submit" className="w-full" disabled={!passcode.trim()}>Open</Button>
          </form>
        )}

        {problem.canRequestAccess && !sent && (
          <form className="mt-6 space-y-3" onSubmit={sendRequest}>
            <p className="text-sm font-medium text-foreground">Ask for a new link</p>
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} aria-label="Your name" />
            <Input type="email" placeholder="Your email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your email" />
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
              rows={3}
              placeholder="Anything to add? (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              aria-label="Message"
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={sending || !name.trim()}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send request
            </Button>
          </form>
        )}
        {sent && <p role="status" className="mt-6 rounded-md bg-secondary p-3 text-sm text-foreground">Thanks. We let the person who shared this know.</p>}
      </div>
    </main>
  );
}
