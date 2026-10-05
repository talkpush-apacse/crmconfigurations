/**
 * Configuration Plan MCP module (read-only).
 * One tool: get_config_plan. It never writes anything, to this app or to a client's CRM.
 */

import { z } from "zod";
import { renderPlanMarkdown } from "@/lib/config-plan/markdown";
import { loadConfigPlan } from "@/lib/config-plan/service";
import { defineTool, type ToolModule } from "@/lib/mcp/toolkit";
import { TrackerError } from "@/lib/tracker/errors";

export const getConfigPlanTool = defineTool({
  name: "get_config_plan",
  description:
    "Build the Talkpush configuration plan for one client from their CRM Config Checklist and their Process Workflow. " +
    "Read-only: it lists what to create in the CRM (attributes, labels, folders, message templates, questions, autoflows, campaigns and more), " +
    "where each name came from (checklist, workflow or both), how it gets configured (Claude can create it with the Talkpush CRM tools, do it by hand, or ticket another team), " +
    "and the build order. It also lists what the workflow has that the checklist lacks, and workflow steps that need something but do not name it. " +
    "It never changes the checklist or any CRM: to add a missing item to the checklist, use the checklist tools after the person confirms. " +
    "Check the 'warnings' first.",
  access: "read",
  input: {
    checklist: z.string().describe("The client's checklist: its slug or id (see the checklist tools)."),
    workflow: z.string().optional().describe("The client's workflow: its id, or its name. Omit to build the plan from the checklist alone."),
    version: z
      .enum(["published", "current"])
      .optional()
      .describe("Which workflow version to read. Default: the published version, or the current draft (with a warning) when none is published."),
    detail: z
      .enum(["summary", "full"])
      .default("summary")
      .describe("summary = counts per kind of object, gaps and warnings. full = every name, plus a Markdown version."),
  },
  handler: async ({ checklist, workflow, version, detail }) => {
    const plan = await loadConfigPlan({ checklist, workflow, version });
    if (detail === "full") return { plan, markdown: renderPlanMarkdown(plan) };
    return {
      client: plan.client,
      checklist: plan.checklist,
      workflow: plan.workflow,
      warnings: plan.warnings,
      buildOrder: plan.sections.map((s) => ({
        order: s.order,
        object: s.label,
        configure: s.configure,
        tools: s.tools,
        items: s.counts.total,
        inBoth: s.counts.both,
        checklistOnly: s.counts.checklistOnly,
        workflowOnly: s.counts.workflowOnly,
      })),
      workflowNotInChecklist: plan.workflowNotInChecklist,
      checklistNotInWorkflow: plan.checklistNotInWorkflow,
      needsADecision: plan.unresolved.length,
      next: "Call again with detail=full to see every name and a Markdown version.",
    };
  },
});

export const configPlanModule: ToolModule = {
  id: "config-plan",
  name: "Configuration Plan",
  instructions:
    "Builds a read-only Talkpush configuration plan from a client's CRM Config Checklist and Process Workflow (get_config_plan). " +
    "It plans; it does not create anything. Creating objects in a client's CRM is a separate step that needs the person's approval, per client. " +
    "Never add names from the plan to the checklist without the person confirming them first.",
  tools: [getConfigPlanTool],
  isUserError: (err): err is Error => err instanceof TrackerError,
  logPrefix: "config-plan-mcp",
};
