"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectSnapshot } from "@/lib/tracker/snapshot";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { ExecSummary } from "./ExecSummary";
import { ErrorBlock } from "./PageHeader";
import { SummarySkeleton } from "./SummarySkeleton";

type Readings = Record<string, { asOf: string; value: number }[]>;

/** The internal exec summary: includes team-only items and blocker reasons. */
export function SummaryView({ projectId, refreshKey }: { projectId: string; refreshKey: string }) {
  const snapshot = useApiResource<ProjectSnapshot>(`/api/tracker/projects/${projectId}/snapshot?k=${encodeURIComponent(refreshKey)}`);
  const metrics = useApiResource<{ readings: Readings }>(`/api/tracker/projects/${projectId}/metrics?k=${encodeURIComponent(refreshKey)}`);

  if (snapshot.error && !snapshot.data) return <ErrorBlock message={snapshot.error} onRetry={snapshot.reload} />;
  if (!snapshot.data) return <SummarySkeleton context="staff" label="Loading summary" />;

  return (
    <ExecSummary
      data={snapshot.data}
      context="staff"
      embedded
      readings={metrics.data?.readings}
      banner={
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Internal view.</span> Includes team-only items and blocker reasons. Clients never see these.
          </p>
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href={`/admin/tracker/projects/${projectId}/client-preview`}>
              <Eye className="h-4 w-4" />
              View as client
            </Link>
          </Button>
        </div>
      }
    />
  );
}
