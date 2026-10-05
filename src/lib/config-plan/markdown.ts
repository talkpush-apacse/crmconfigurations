import type { Configure, ConfigPlan, PlanEntry, PlanSection } from "./types";

const HOW: Record<Configure, string> = {
  mcp: "Claude can create these with the Talkpush CRM tools",
  manual: "Do these by hand in the CRM",
  ticket: "Another team builds these (ticket)",
};

const SOURCE: Record<PlanEntry["source"], string> = {
  both: "checklist and workflow",
  checklist: "checklist only",
  workflow: "workflow only",
};

function entryLine(e: PlanEntry): string {
  const steps = e.steps && e.steps.length > 0 ? `, step ${e.steps.map((s) => s.step || "?").slice(0, 4).join(", ")}${e.steps.some((s) => s.basis === "wording") ? " (name read from the step title: check it)" : ""}` : "";
  const maybe = e.possibleMatch ? ` Possibly the same as "${e.possibleMatch}".` : "";
  return `- ${e.name}${e.detail ? ` (${e.detail})` : ""} [${SOURCE[e.source]}${steps}]${maybe}`;
}

function sectionBlock(s: PlanSection, byKey: Map<string, PlanSection>): string {
  const lines = [`### ${s.label}`, `${HOW[s.configure]}${s.tools.length > 0 ? `: ${s.tools.join(", ")}` : ""}.`];
  const needs = s.dependsOn.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!.label);
  if (needs.length > 0) lines.push(`Needs first: ${needs.join(", ")}.`);
  if (s.note) lines.push(s.note);
  lines.push("");
  lines.push(...(s.entries.length > 0 ? s.entries.map(entryLine) : ["- Nothing captured yet."]));
  return lines.join("\n");
}

/** The plan as Markdown, for pasting into a ticket, a message, or back to Claude. */
export function renderPlanMarkdown(plan: ConfigPlan): string {
  const byKey = new Map(plan.sections.map((s) => [s.key, s]));
  const out: string[] = [];
  out.push(`# Configuration plan: ${plan.client}`);
  out.push(
    `Checklist: ${plan.checklist.clientName} (version ${plan.checklist.version}). ` +
      (plan.workflow
        ? `Workflow: ${plan.workflow.name}, ${plan.workflow.version === "published" ? "published version" : "current draft"}, ${plan.workflow.stepCount} steps.`
        : "No workflow.")
  );
  if (plan.warnings.length > 0) out.push("", "**Check first**", ...plan.warnings.map((w) => `- ${w}`));

  out.push("", "## Build order", "", "| Order | Object | How | Items | In both | Checklist only | Workflow only |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const s of plan.sections) {
    out.push(`| ${s.order} | ${s.label} | ${s.configure} | ${s.counts.total} | ${s.counts.both} | ${s.counts.checklistOnly} | ${s.counts.workflowOnly} |`);
  }

  for (const how of ["mcp", "manual", "ticket"] as Configure[]) {
    const group = plan.sections.filter((s) => s.configure === how);
    if (group.length === 0) continue;
    out.push("", `## ${HOW[how]}`);
    for (const s of group) out.push("", sectionBlock(s, byKey));
  }

  if (plan.workflowNotInChecklist.length > 0) {
    out.push("", "## The workflow has these but the checklist does not", "Add them to the checklist after you confirm. Nothing is added automatically.");
    for (const g of plan.workflowNotInChecklist) out.push(`- ${g.label}: ${g.names.join(", ")}`);
  }
  if (plan.checklistNotInWorkflow.length > 0) {
    out.push("", "## The checklist has these but no workflow step mentions them");
    for (const g of plan.checklistNotInWorkflow) out.push(`- ${g.label}: ${g.names.join(", ")}`);
  }
  if (plan.unresolved.length > 0) {
    out.push("", "## Needs a decision", "These workflow steps need something in the CRM but do not name it.");
    for (const u of plan.unresolved) out.push(`- ${u.step ? `Step ${u.step}: ` : ""}${u.label || "(untitled)"}. ${u.reason}`);
  }
  return out.join("\n");
}
