"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { ExecSummary } from "@/components/tracker/ExecSummary";
import { ErrorBlock } from "@/components/tracker/PageHeader";
import { SummarySkeleton } from "@/components/tracker/SummarySkeleton";
import type { ClientView } from "@/lib/tracker/client-view";
import { useApiResource } from "@/lib/tracker/use-api-resource";

/** Staff-only preview: exactly what a client would see, in the executive-report palette. */
export default function ClientPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApiResource<ClientView>(`/api/tracker/projects/${id}/client-view`);

  return (
    <>
      <Link href={`/admin/tracker/projects/${id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm md:min-h-8 text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to project
      </Link>
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data ? (
        <SummarySkeleton context="client" label="Loading client view" />
      ) : (
        <ExecSummary
          data={data}
          context="client"
          banner={
            <div className="flex items-start gap-2 rounded-lg border border-[var(--es-line)] bg-[var(--es-card)] px-4 py-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-medium">Preview.</span> This is exactly what a client sees. Team-only items, internal remarks, blocker reasons, activity history and email addresses are not included, and the numbers count only what the client can see.
              </p>
            </div>
          }
        />
      )}
    </>
  );
}
