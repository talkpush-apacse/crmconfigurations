"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/components/workflow/ui/toast";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/workflow/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ScopingArtifactKind,
  ScopingArtifactSeverity,
  ScopingArtifactStatus,
  WorkflowScopingArtifact,
  WorkflowValidationFinding,
} from "@/lib/workflow/types";

type SEBriefPanelProps = {
  workflowId: string;
  onClose: () => void;
};

type ValidationResponse = {
  findings?: WorkflowValidationFinding[];
  counts?: Record<string, number>;
};

const ARTIFACT_KIND_OPTIONS: Array<{
  value: ScopingArtifactKind;
  label: string;
}> = [
  { value: "assumption", label: "Assumption" },
  { value: "open_question", label: "Open question" },
  { value: "risk", label: "Risk" },
  { value: "decision", label: "Decision" },
  { value: "call_note", label: "Call note" },
  { value: "customer_summary", label: "Customer summary" },
];

const SEVERITY_OPTIONS: Array<{
  value: ScopingArtifactSeverity;
  label: string;
}> = [
  { value: "info", label: "Info" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const SECTION_LABELS: Record<ScopingArtifactKind, string> = {
  assumption: "Assumptions",
  open_question: "Open questions",
  risk: "Risks",
  decision: "Decisions",
  call_note: "Call notes",
  customer_summary: "Customer summary",
};

function severityClass(severity: string) {
  return cn(
    "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
    severity === "critical" && "bg-destructive/15 text-destructive",
    severity === "high" && "bg-destructive/10 text-destructive",
    severity === "medium" && "bg-brand-amber/25 text-foreground",
    severity === "low" && "bg-brand-lavender-lightest text-foreground",
    severity === "info" && "bg-muted text-foreground/70"
  );
}

function statusClass(status: string) {
  return cn(
    "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
    status === "open" && "bg-brand-amber/15 text-foreground",
    status === "confirmed" && "bg-brand-lavender-lightest text-foreground",
    status === "resolved" && "bg-brand-sage/15 text-foreground",
    status === "dismissed" && "bg-muted text-muted-foreground"
  );
}

export default function SEBriefPanel({ workflowId, onClose }: SEBriefPanelProps) {
  const [artifacts, setArtifacts] = useState<WorkflowScopingArtifact[]>([]);
  const [findings, setFindings] = useState<WorkflowValidationFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [kind, setKind] = useState<ScopingArtifactKind>("open_question");
  const [severity, setSeverity] = useState<ScopingArtifactSeverity>("info");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  const groupedArtifacts = useMemo(() => {
    return ARTIFACT_KIND_OPTIONS.reduce<Record<ScopingArtifactKind, WorkflowScopingArtifact[]>>(
      (acc, option) => {
        acc[option.value] = artifacts.filter((artifact) => artifact.kind === option.value);
        return acc;
      },
      {
        assumption: [],
        open_question: [],
        risk: [],
        decision: [],
        call_note: [],
        customer_summary: [],
      }
    );
  }, [artifacts]);

  const fetchArtifacts = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflowId}/scoping-artifacts`);
    const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load scoping artifacts");
    }
    setArtifacts(data.items ?? []);
  }, [workflowId]);

  const runValidation = useCallback(async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/validate`, {
        method: "POST",
      });
      const data = (await res.json().catch((err) => { console.error("[fetch]", err); return {}; })) as ValidationResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to validate workflow");
      }
      setFindings(data.findings ?? []);
    } finally {
      setValidating(false);
    }
  }, [workflowId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchArtifacts(), runValidation()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load SE brief");
    } finally {
      setLoading(false);
    }
  }, [fetchArtifacts, runValidation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addArtifact() {
    if (!title.trim() || !detail.trim()) {
      toast.error("Title and detail are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/scoping-artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          detail: detail.trim(),
          severity,
          status: kind === "decision" || kind === "call_note" ? "confirmed" : "open",
        }),
      });
      const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
      if (!res.ok) throw new Error(data.error ?? "Failed to add item");
      setTitle("");
      setDetail("");
      setSeverity("info");
      toast.success("SE brief item added");
      await fetchArtifacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function updateArtifactStatus(
    artifact: WorkflowScopingArtifact,
    status: ScopingArtifactStatus
  ) {
    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/scoping-artifacts/${artifact.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
      if (!res.ok) throw new Error(data.error ?? "Failed to update item");
      setArtifacts((current) =>
        current.map((item) =>
          item.id === artifact.id ? { ...item, status } : item
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function removeArtifact(artifact: WorkflowScopingArtifact) {
    const confirmed = window.confirm(`Delete "${artifact.title}" from the SE brief?`);
    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/workflows/${workflowId}/scoping-artifacts/${artifact.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
      if (!res.ok) throw new Error(data.error ?? "Failed to delete item");
      setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
      toast.success("SE brief item deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  async function generateSummary() {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/summary`, {
        method: "POST",
      });
      const data = await res.json().catch((err) => { console.error("[fetch]", err); return {}; });
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate summary");
      }
      toast.success("Customer summary generated");
      await fetchArtifacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  }

  return (
    <div className="w-96 h-full bg-card border-l border-border flex flex-col overflow-hidden max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-30 max-md:!w-[min(20rem,90vw)] max-md:shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList className="h-4 w-4 text-foreground shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">SE Brief</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground/70 md:h-7 md:w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-foreground" />
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Validation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Deterministic implementation checks
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void runValidation()}
                  disabled={validating}
                  className="h-7 gap-1 text-xs"
                >
                  {validating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              </div>

              {findings.length === 0 ? (
                <div className="rounded-md border border-brand-sage/40 bg-brand-sage/15 px-3 py-2 text-xs text-foreground">
                  <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
                  No validation findings.
                </div>
              ) : (
                <div className="space-y-2">
                  {findings.map((finding, index) => (
                    <div
                      key={`${finding.code}-${finding.nodeId ?? finding.edgeId ?? index}`}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-brand-amber-darker" />
                        <span className={severityClass(finding.severity)}>
                          {finding.severity}
                        </span>
                        <span className="text-[11px] uppercase text-muted-foreground">
                          {finding.code}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/85">
                        {finding.message}
                      </p>
                      {finding.recommendation && (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {finding.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-md border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5 text-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Add Item
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as ScopingArtifactKind)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTIFACT_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={severity}
                  onValueChange={(value) => setSeverity(value as ScopingArtifactSeverity)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                className="h-8 text-xs"
              />
              <Textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Details, decision rationale, or customer quote"
                className="min-h-20 text-xs"
              />
              <LoadingButton
                type="button"
                size="sm"
                onClick={addArtifact}
                variant="cta"
                isLoading={saving}
                disabled={!title.trim() || !detail.trim()}
                className="w-full text-xs"
              >
                {!saving && <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Add to SE Brief
              </LoadingButton>
            </section>

            <section className="space-y-2">
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSummary}
                isLoading={generatingSummary}
                className="w-full gap-1.5 text-xs"
              >
                {!generatingSummary && <FileText className="h-3.5 w-3.5" />}
                Generate Customer Summary
              </LoadingButton>
            </section>

            {ARTIFACT_KIND_OPTIONS.map((option) => {
              const items = groupedArtifacts[option.value];
              return (
                <section key={option.value} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {SECTION_LABELS[option.value]}
                    </h3>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                      Nothing captured yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="rounded-md border border-border bg-card p-3"
                        >
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold leading-snug text-foreground">
                                {artifact.title}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className={statusClass(artifact.status)}>
                                  {artifact.status.replace("_", " ")}
                                </span>
                                <span className={severityClass(artifact.severity)}>
                                  {artifact.severity}
                                </span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void removeArtifact(artifact)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/70">
                            {artifact.detail}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {artifact.status !== "resolved" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-foreground hover:bg-brand-sage/15"
                                onClick={() => void updateArtifactStatus(artifact, "resolved")}
                              >
                                Resolve
                              </Button>
                            )}
                            {artifact.status !== "confirmed" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-foreground hover:bg-brand-lavender-lightest"
                                onClick={() => void updateArtifactStatus(artifact, "confirmed")}
                              >
                                Confirm
                              </Button>
                            )}
                            {artifact.status !== "dismissed" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:bg-secondary"
                                onClick={() => void updateArtifactStatus(artifact, "dismissed")}
                              >
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
