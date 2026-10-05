/**
 * The combined MCP connector: every area (CRM Config Checklist, Project Tracker, Workflow Builder, Configuration Plan) behind one URL.
 *
 * To add a new area, make its ToolModule (see docs/adding-an-mcp-tool.md) and add it to `combinedModules` below.
 * The three single-area URLs (/api/mcp, /api/mcp/tracker, /api/mcp/workflows) keep working unchanged.
 * Tool names must be unique across all areas; the server refuses to start (and a test fails) if two clash.
 */

import { configPlanModule } from "@/lib/mcp/config-plan";
import { checklistModule } from "@/lib/mcp/modules";
import { buildMcpServer, type ToolContext, type ToolModule } from "@/lib/mcp/toolkit";
import { trackerModule } from "@/lib/mcp/tracker";
import { createWorkflowModule } from "@/lib/mcp/workflows";

export const COMBINED_RESOURCE_PATH = "/api/mcp/all";

/** The Workflow Builder needs the site address (some tools return links), so the list is built per request. */
export function combinedModules(origin: string): ToolModule[] {
  return [checklistModule, trackerModule, createWorkflowModule(origin), configPlanModule];
}

const INTRO =
  "Talkpush Implementation Hub. One connector for four areas: CRM Config Checklists (list_/get_ checklist tools), " +
  "the Project Tracker (tracker tools), the Workflow Builder (workflow, step, version, comment and sharing tools), " +
  "and the Configuration Plan (get_config_plan, read-only). " +
  "Use only the area the request is about, and follow that area's rules below.";

export function combinedInstructions(modules: ToolModule[]): string {
  const sections = modules
    .filter((m) => m.instructions)
    .map((m) => `## ${m.name}\n${m.instructions}`);
  return [INTRO, ...sections].join("\n\n");
}

export function createCombinedMcpServer(origin: string, ctx: ToolContext) {
  const modules = combinedModules(origin);
  return buildMcpServer(
    { name: "Talkpush Implementation Hub", version: "1.0.0", instructions: combinedInstructions(modules) },
    modules,
    ctx
  );
}
