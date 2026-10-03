"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import ClientWorkflowViewer from "@/components/workflow/client/ClientWorkflowViewer";
import { clientDownloadMenu } from "@/components/workflow/client/downloads";
import { previewApi } from "@/components/workflow/client/api";
import { WorkflowToaster } from "@/components/workflow/ui/toast";
import type { ClientPagePayload } from "@/lib/workflow/access/client-payload";

export default function PreviewClient({ workflowId, mode, label }: { workflowId: string; mode: string; label: string }) {
  const api = useMemo(() => previewApi(workflowId, mode), [workflowId, mode]);
  const [payload, setPayload] = useState<ClientPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.load().then(setPayload).catch((e) => setError(e instanceof Error ? e.message : "Could not load the preview."));
  }, [api]);

  if (error) return <main className="p-8 text-sm text-destructive" role="alert">{error}</main>;
  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  return (
    <>
      <ClientWorkflowViewer initial={payload} api={api} previewLabel={label} headerExtras={clientDownloadMenu} />
      <WorkflowToaster />
    </>
  );
}
