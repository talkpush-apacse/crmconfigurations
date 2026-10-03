"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { WorkflowToaster } from "@/components/workflow/ui/toast";
import type { ClientPagePayload } from "@/lib/workflow/access/client-payload";
import { ApiFailure, tokenApi, type ApiProblem } from "./api";
import ClientWorkflowViewer from "./ClientWorkflowViewer";
import { clientDownloadMenu } from "./downloads";
import ProblemPage from "./ProblemPage";

const passKey = (token: string) => `wf-passcode:${token}`;

/**
 * The client page's front door. The server has already checked the link and (usually) sent the data; this decides
 * between the diagram, the friendly "this link does not work" page, and the passcode box.
 */
export default function ClientWorkflowGate({
  token,
  initial,
  initialProblem,
}: {
  token: string;
  initial: ClientPagePayload | null;
  initialProblem: ApiProblem | null;
}) {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [payload, setPayload] = useState(initial);
  const [problem, setProblem] = useState(initialProblem);
  const [loading, setLoading] = useState(false);
  const api = useMemo(() => tokenApi(token, passcode), [token, passcode]);

  async function tryPasscode(code: string) {
    setLoading(true);
    try {
      const data = await tokenApi(token, code).load({ firstLoad: true });
      try {
        sessionStorage.setItem(passKey(token), code);
      } catch {
        // private mode: they will be asked again next time
      }
      setPasscode(code);
      setPayload(data);
      setProblem(null);
    } catch (err) {
      if (err instanceof ApiFailure) setProblem(err.info);
      else setProblem({ status: 500, error: "Could not open this link.", title: "Something went wrong", message: "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  // A passcode typed earlier in this browser tab is reused.
  useEffect(() => {
    if (problem?.problem !== "passcode_required") return;
    try {
      const saved = sessionStorage.getItem(passKey(token));
      if (saved) void tryPasscode(saved);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {loading && !payload ? (
        <main className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
        </main>
      ) : payload ? (
        <ClientWorkflowViewer initial={payload} api={api} headerExtras={clientDownloadMenu} />
      ) : problem ? (
        <ProblemPage problem={problem} api={api} onPasscode={tryPasscode} />
      ) : null}
      <WorkflowToaster />
    </>
  );
}
