"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConfigPlan, Configure, PlanEntry, PlanSection } from "@/lib/config-plan/types";
import { useApiResource } from "@/lib/tracker/use-api-resource";
import { ErrorBlock, LoadingBlock, PageHeader } from "./PageHeader";

interface Payload {
  plan: ConfigPlan;
  markdown: string;
  candidates: { id: string; name: string; status: string; published: boolean }[];
  selectedWorkflowId: string | null;
}

const NONE = "__none";

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">{children}</span>;
}
const HOW: Record<Configure, { title: string; blurb: string }> = {
  mcp: { title: "Claude can create these", blurb: "With the Talkpush CRM tools, after you approve. This plan creates nothing." },
  manual: { title: "Do these by hand in the CRM", blurb: "There is no create tool for these." },
  ticket: { title: "Another team builds these", blurb: "Raise a ticket with the details below." },
};
const SOURCE_TEXT: Record<PlanEntry["source"], string> = { both: "Checklist and workflow", checklist: "Checklist only", workflow: "Workflow only" };

export function ConfigPlanView({ projectId }: { projectId: string }) {
  const [workflow, setWorkflow] = useState<string>("");
  const [version, setVersion] = useState<string>("published");
  const query = new URLSearchParams();
  if (workflow && workflow !== NONE) query.set("workflow", workflow);
  query.set("version", version);
  const { data, error, reload } = useApiResource<Payload>(`/api/tracker/projects/${projectId}/config-plan?${query.toString()}`);
  const [copied, setCopied] = useState(false);

  const back = (
    <Link href={`/admin/tracker/projects/${projectId}`} className="mb-3 inline-flex min-h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" />
      Back to the project
    </Link>
  );

  if (error && !data) {
    return (
      <>
        {back}
        <ErrorBlock message={error} onRetry={reload} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {back}
        <LoadingBlock label="Building the plan" />
      </>
    );
  }

  const { plan } = data;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const selected = workflow || data.selectedWorkflowId || NONE;

  return (
    <>
      {back}
      <PageHeader
        title="Configuration plan"
        description={`${plan.client}. Built from the CRM checklist${plan.workflow ? ` and the workflow "${plan.workflow.name}"` : ""}. Read only: nothing is created or changed.`}
        actions={
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy as Markdown"}
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          Workflow
          <Select value={selected} onValueChange={setWorkflow}>
            <SelectTrigger className="w-full" aria-label="Workflow">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No workflow (checklist only)</SelectItem>
              {data.candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.published ? " (published)" : " (draft)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Workflow version
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger className="w-full" aria-label="Workflow version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published">Published version (falls back to the draft)</SelectItem>
              <SelectItem value="current">Current draft</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {plan.warnings.length > 0 && (
        <div role="status" className="mb-6 rounded-lg border border-status-pending/50 bg-status-pending/15 px-4 py-3 text-sm">
          <p className="font-medium">Check first</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="order-title" className="mb-8">
        <h2 id="order-title" className="mb-2 text-lg font-bold tracking-tight">
          Build order
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="bg-secondary text-left text-xs uppercase tracking-wider">
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Object</th>
                <th className="px-4 py-2 font-semibold">How</th>
                <th className="px-4 py-2 text-right font-semibold">Items</th>
                <th className="px-4 py-2 text-right font-semibold">Both</th>
                <th className="px-4 py-2 text-right font-semibold">Checklist only</th>
                <th className="px-4 py-2 text-right font-semibold">Workflow only</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plan.sections.map((s) => (
                <tr key={s.key}>
                  <td className="px-4 py-2 tabular-nums">{s.order}</td>
                  <td className="px-4 py-2 font-medium">{s.label}</td>
                  <td className="px-4 py-2">{s.configure === "mcp" ? "Claude can create" : s.configure === "manual" ? "By hand" : "Ticket"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.counts.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.counts.both}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.counts.checklistOnly}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.counts.workflowOnly}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {plan.workflowNotInChecklist.length > 0 && (
        <section aria-labelledby="gap-title" className="mb-8 rounded-xl border border-border bg-card p-4">
          <h2 id="gap-title" className="text-lg font-bold tracking-tight">
            The workflow has these, the checklist does not
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Confirm them, then ask Claude to add them to the checklist. Nothing is added automatically.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {plan.workflowNotInChecklist.map((g) => (
              <li key={g.section}>
                <span className="font-medium">{g.label}:</span> {g.names.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(["mcp", "manual", "ticket"] as Configure[]).map((how) => {
        const group = plan.sections.filter((s) => s.configure === how);
        if (group.length === 0) return null;
        return (
          <section key={how} aria-labelledby={`how-${how}`} className="mb-8">
            <h2 id={`how-${how}`} className="text-lg font-bold tracking-tight">
              {HOW[how].title}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{HOW[how].blurb}</p>
            <div className="space-y-5">
              {group.map((s) => (
                <SectionCard key={s.key} section={s} all={plan.sections} />
              ))}
            </div>
          </section>
        );
      })}

      {plan.unresolved.length > 0 && (
        <section aria-labelledby="decide-title" className="mb-8 rounded-xl border border-border bg-card p-4">
          <h2 id="decide-title" className="text-lg font-bold tracking-tight">
            Needs a decision
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">These workflow steps need something in the CRM but do not name it.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {plan.unresolved.map((u, i) => (
              <li key={`${u.step}-${i}`}>
                {u.step ? `Step ${u.step}: ` : ""}
                <span className="font-medium">{u.label || "Untitled step"}</span>. {u.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SectionCard({ section, all }: { section: PlanSection; all: PlanSection[] }) {
  const needs = section.dependsOn.map((k) => all.find((s) => s.key === k)?.label).filter(Boolean);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{section.label}</h3>
      {section.tools.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Tools: {section.tools.join(", ")}</p>}
      {needs.length > 0 && <p className="text-xs text-muted-foreground">Needs first: {needs.join(", ")}</p>}
      {section.note && <p className="mt-1 text-sm">{section.note}</p>}
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
        {section.entries.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Nothing captured yet.</li>}
        {section.entries.map((e) => (
          <li key={`${e.source}-${e.name}`} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {e.name}
                {e.detail && <span className="font-normal text-muted-foreground"> ({e.detail})</span>}
              </p>
              {e.steps && e.steps.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Step {e.steps.map((s) => s.step || "?").slice(0, 4).join(", ")}
                  {e.steps.some((s) => s.basis === "wording") ? ". Name read from the step title: check it." : ""}
                </p>
              )}
              {e.possibleMatch && <p className="text-xs text-muted-foreground">Possibly the same as &quot;{e.possibleMatch}&quot;.</p>}
            </div>
            <Tag>{SOURCE_TEXT[e.source]}</Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}
