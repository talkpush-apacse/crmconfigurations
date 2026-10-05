"use client";

import { useMemo, useState } from "react";
import { ListChecks, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudienceBadge, groupPlanItems, Tag } from "@/components/tracker/PlanParts";
import { PlanItemDialog } from "@/components/tracker/PlanItemDialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/tracker/PageHeader";
import { api, errorMessage } from "@/lib/tracker/client-api";
import { PLAN_AUDIENCE_LABELS } from "@/lib/tracker/constants";
import type { PlanTemplateItemDTO } from "@/lib/tracker/plan-service";
import { plural } from "@/lib/tracker/format";
import { useApiResource } from "@/lib/tracker/use-api-resource";

interface CatalogueDTO {
  template: { id: string; name: string; description: string | null; version: number } | null;
  items: PlanTemplateItemDTO[];
  standardItemCount: number;
}

export default function StandardPlanPage() {
  const [showArchived, setShowArchived] = useState(false);
  const { data, error, reload } = useApiResource<CatalogueDTO>(`/api/tracker/plan-template${showArchived ? "?archived=1" : ""}`);
  const [editing, setEditing] = useState<PlanTemplateItemDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const blocks = useMemo(() => groupPlanItems(data?.items ?? []), [data]);
  const titleByKey = useMemo(() => new Map((data?.items ?? []).map((i) => [i.key, i.title])), [data]);

  const loadStandard = async () => {
    setLoading(true);
    setLoadError("");
    try {
      await api("/api/tracker/plan-template", { method: "POST" });
      reload();
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (error && !data) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock label="Loading the standard plan" />;

  if (!data.template) {
    return (
      <>
        <PageHeader title="Standard plan" description="The checklist every new implementation starts from." />
        <EmptyState
          icon={ListChecks}
          title="The standard plan is not set up yet"
          description={`Load the standard Talkpush implementation plan: ${data.standardItemCount} items from kickoff to the end of hypercare. You can edit it afterwards, and tick only what each client needs.`}
          action={
            <div className="space-y-2">
              <Button onClick={loadStandard} disabled={loading}>
                {loading ? "Loading" : `Load the standard plan (${data.standardItemCount} items)`}
              </Button>
              {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
            </div>
          }
        />
      </>
    );
  }

  const active = data.items.filter((i) => !i.archived);

  return (
    <>
      <PageHeader
        title="Standard plan"
        description={`${plural(active.length, "item")} in ${data.template.name}. Open a project and choose Build plan to tick what that client needs.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
            <Button onClick={loadStandard} variant="outline" disabled={loading} title="Adds any standard items that are missing. Your edits are kept.">
              {loading ? "Checking" : "Add missing standard items"}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </>
        }
      />
      {loadError && <p role="alert" className="mb-4 text-sm text-destructive">{loadError}</p>}

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">{PLAN_AUDIENCE_LABELS.internal}</strong> items never show to the client.{" "}
        <strong className="font-medium text-foreground">{PLAN_AUDIENCE_LABELS.shared}</strong> items are Talkpush work the client can follow.{" "}
        <strong className="font-medium text-foreground">{PLAN_AUDIENCE_LABELS.client}</strong> items are for the client to do. Timing is in working days from the project start.
      </p>

      <div className="space-y-8">
        {blocks.map((block) => (
          <section key={block.phase} aria-labelledby={`phase-${block.phase}`}>
            <h2 id={`phase-${block.phase}`} className="mb-3 text-lg font-bold tracking-tight">
              {block.phase}
            </h2>
            <div className="space-y-5">
              {block.groups.map((group) => (
                <div key={group.name}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.name}</h3>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                    {group.items.map((item) => (
                      <li key={item.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${item.archived ? "opacity-60" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.timing}
                            {item.dependsOnKeys.length > 0 && (
                              <>
                                {" "}
                                · Waits on {item.dependsOnKeys.map((k) => titleByKey.get(k) ?? k).slice(0, 2).join(", ")}
                                {item.dependsOnKeys.length > 2 ? ` and ${item.dependsOnKeys.length - 2} more` : ""}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AudienceBadge audience={item.audience} />
                          {item.isMilestone && <Tag>Milestone</Tag>}
                          {!item.defaultIncluded && <Tag>Optional</Tag>}
                          {item.archived && <Tag>Archived</Tag>}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => {
                              setEditing(item);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <PlanItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} allItems={data.items} onSaved={reload} />
    </>
  );
}
