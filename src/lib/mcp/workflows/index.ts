/**
 * Workflow Builder MCP module: the 29 tools of the original Workflow Editor connector, served through this
 * app's toolkit (same behaviour, same names, same inputs).
 *
 * The tool bodies live in src/lib/workflow/tool-handlers.ts (unchanged logic from the original editor);
 * the tool list and input descriptions live in definitions.ts. Phase 4 of the spec adds the new tools
 * (flow table, gap check, render preview, sharing and review tools).
 */

import { defineTool, buildMcpServer, type AnyTool, type ToolContext, type ToolModule } from "@/lib/mcp/toolkit";
import { McpToolInputError, McpToolNotFoundError, callWorkflowTool } from "@/lib/workflow/tool-handlers";
import { ScopingInputError } from "@/lib/workflow/scoping";
import { workflowToolDefinitions } from "./definitions";
import { inputShape } from "./json-schema-to-zod";
import { workflowMcpSystemPrompt } from "./system-prompt";

/** Tools that only look. Everything else changes data (and says so in the generated docs and tests). */
export const WORKFLOW_READ_TOOLS = new Set([
  "list_workflows",
  "get_workflow",
  "list_templates",
  "get_template",
  "list_versions",
  "list_scoping_artifacts",
  "validate_workflow",
  "renumber_steps",
  "list_pages",
  "get_flow_table",
  "run_gap_check",
  "lint_layout",
  "render_preview",
  "diff_versions",
  "list_access",
  "list_suggestions",
  "list_comments",
]);

/**
 * The module needs to know the site's address, because some tools return links (edit page, review link).
 * Build it per request with the request's origin.
 */
export function createWorkflowModule(origin: string): ToolModule {
  const tools: AnyTool[] = workflowToolDefinitions.map((def) =>
    defineTool({
      name: def.name,
      description: def.description,
      access: WORKFLOW_READ_TOOLS.has(def.name) ? "read" : "write",
      input: inputShape(def.inputSchema),
      handler: async (args, ctx) => {
        // run_gap_check is a "read" tool, but it can also SAVE its findings into the workflow. A read-only connection may
        // run the check and read the result; it may not save.
        if (ctx.readOnly && (args as { saveAsArtifacts?: unknown }).saveAsArtifacts === true) {
          throw new McpToolInputError("This connection is read-only, so findings cannot be saved. Run the check again without saveAsArtifacts.");
        }
        return callWorkflowTool(def.name, args, { origin, actor: ctx.actor.label });
      },
    })
  );
  return {
    id: "workflows",
    name: "Workflow Builder",
    instructions: workflowMcpSystemPrompt,
    tools,
    isUserError: (err): err is Error =>
      err instanceof McpToolInputError || err instanceof McpToolNotFoundError || err instanceof ScopingInputError,
    logPrefix: "workflow-mcp",
  };
}

/** Writes are logged as "Claude (MCP)" until callers can be told apart (the activity log arrives with the audit trail in phase 2). */
const DEFAULT_CONTEXT: ToolContext = { actor: { label: "Claude (MCP)", via: "mcp" } };

export function createWorkflowMcpServer(origin: string, ctx: ToolContext = DEFAULT_CONTEXT) {
  const workflowModule = createWorkflowModule(origin);
  return buildMcpServer({ name: workflowModule.name, version: "1.0.0" }, [workflowModule], ctx);
}
