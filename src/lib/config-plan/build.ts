import type { ChecklistFindings, Named } from "./from-checklist";
import type { Found, WorkflowFindings } from "./from-workflow";
import { looksLikeSameThing, normalizeName } from "./names";
import { MATCHED_SECTIONS, SECTION_SPECS } from "./spec";
import type { ConfigPlan, PlanEntry, PlanSection, SectionKey } from "./types";

/**
 * Combines the checklist findings and the workflow findings into the plan. Pure: no database, no clock.
 * Names that match after tidying (case, punctuation, spacing) are one entry from "both". Close but different
 * names stay separate and point at each other for a person to decide.
 */

export interface BuildInput {
  checklist: ChecklistFindings;
  workflow: WorkflowFindings | null;
  meta: {
    client: string;
    checklist: ConfigPlan["checklist"];
    workflow: ConfigPlan["workflow"];
    warnings?: string[];
  };
}

function workflowFor(key: SectionKey, w: WorkflowFindings): Found[] {
  switch (key) {
    case "folders":
      return w.folders;
    case "message_templates":
      return w.messageTemplates;
    case "rejection_reasons":
      return w.rejectionReasons;
    case "integrations":
      return w.integrations;
    case "questions":
      return w.questionSets;
    case "ai_agents":
      return w.aiAgents;
    default:
      return [];
  }
}

function fromChecklistOnly(list: Named[]): PlanEntry[] {
  return list.map((n) => ({ name: n.name, source: "checklist" as const, detail: n.detail }));
}

function matchEntries(checklist: Named[], workflow: Found[]): PlanEntry[] {
  const entries: PlanEntry[] = [];
  const unmatchedWorkflow = new Map(workflow.map((f) => [normalizeName(f.name), f]));
  const checklistOnly: Named[] = [];

  for (const c of checklist) {
    const key = normalizeName(c.name);
    const hit = unmatchedWorkflow.get(key);
    if (hit) {
      entries.push({ name: c.name, source: "both", detail: c.detail ?? hit.detail, steps: hit.steps });
      unmatchedWorkflow.delete(key);
    } else {
      checklistOnly.push(c);
    }
  }
  const leftoverWorkflow = [...unmatchedWorkflow.values()];

  const suggestion = (name: string, others: string[]) => others.find((o) => looksLikeSameThing(normalizeName(name), normalizeName(o)));
  for (const c of checklistOnly) {
    entries.push({ name: c.name, source: "checklist", detail: c.detail, possibleMatch: suggestion(c.name, leftoverWorkflow.map((f) => f.name)) });
  }
  for (const f of leftoverWorkflow) {
    entries.push({ name: f.name, source: "workflow", detail: f.detail, steps: f.steps, possibleMatch: suggestion(f.name, checklistOnly.map((c) => c.name)) });
  }
  return entries;
}

function countOf(entries: PlanEntry[]): PlanSection["counts"] {
  return {
    total: entries.length,
    both: entries.filter((e) => e.source === "both").length,
    checklistOnly: entries.filter((e) => e.source === "checklist").length,
    workflowOnly: entries.filter((e) => e.source === "workflow").length,
  };
}

export function buildConfigPlan(input: BuildInput): ConfigPlan {
  const { checklist, workflow, meta } = input;
  const warnings = [...(meta.warnings ?? []), ...checklist.warnings];
  const sections: PlanSection[] = [];
  const workflowNotInChecklist: ConfigPlan["workflowNotInChecklist"] = [];
  const checklistNotInWorkflow: ConfigPlan["checklistNotInWorkflow"] = [];

  for (const key of Object.keys(SECTION_SPECS) as SectionKey[]) {
    const spec = SECTION_SPECS[key];
    const fromList = checklist[key] as Named[];
    const matched = MATCHED_SECTIONS.includes(key);

    let entries: PlanEntry[];
    if (workflow && matched) {
      entries = matchEntries(fromList, workflowFor(key, workflow));
    } else {
      entries = fromChecklistOnly(fromList);
      // Where names are not compared (questions, AI agents), the workflow's own names are still listed.
      if (workflow) {
        const extra = workflowFor(key, workflow);
        const mine = new Set(entries.map((e) => normalizeName(e.name)));
        for (const f of extra) {
          if (!mine.has(normalizeName(f.name))) entries.push({ name: f.name, source: "workflow", detail: f.detail ?? (key === "questions" ? "question set named in the workflow" : undefined), steps: f.steps });
        }
      }
    }

    // Campaign types and automated steps are context, not names to match.
    let note = spec.note;
    if (key === "campaigns" && workflow && workflow.campaignTypes.length > 0) {
      note = `${note ? `${note} ` : ""}The workflow uses these campaign types: ${workflow.campaignTypes.join(", ")}.`.trim();
    }
    if (key === "autoflows" && workflow) {
      note = `${note ? `${note} ` : ""}The workflow has ${workflow.automatedSteps.length} automated steps (each is a candidate for one autoflow); the checklist lists ${fromList.length} autoflow rules.`.trim();
    }

    if (entries.length === 0 && !note) continue;
    if (entries.length === 0 && !["autoflows", "campaigns", "questions", "folders", "message_templates"].includes(key)) continue;

    sections.push({
      key,
      label: spec.label,
      configure: spec.configure,
      tools: spec.tools,
      order: spec.order,
      dependsOn: spec.dependsOn,
      note,
      entries,
      counts: countOf(entries),
    });

    if (workflow && matched) {
      const only = (src: "workflow" | "checklist") => entries.filter((e) => e.source === src).map((e) => e.name);
      if (only("workflow").length > 0) workflowNotInChecklist.push({ section: key, label: spec.label, names: only("workflow") });
      if (only("checklist").length > 0) checklistNotInWorkflow.push({ section: key, label: spec.label, names: only("checklist") });
    }
  }

  sections.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  return {
    client: meta.client,
    checklist: meta.checklist,
    workflow: meta.workflow,
    sections,
    unresolved: workflow?.unresolved ?? [],
    workflowNotInChecklist,
    checklistNotInWorkflow,
    warnings: workflow ? warnings : [...warnings, "No workflow was given, so this plan comes from the checklist alone."],
  };
}
