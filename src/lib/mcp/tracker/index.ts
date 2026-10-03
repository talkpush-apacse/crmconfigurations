/**
 * Project Tracker MCP module.
 *
 * Add a tool: write a defineTool in read-tools.ts or write-tools.ts, add it to that file's list,
 * then run `npm run mcp:docs`. See docs/adding-an-mcp-tool.md.
 */

import { buildMcpServer, type ToolContext, type ToolModule } from "@/lib/mcp/toolkit";
import { TrackerError } from "@/lib/tracker/errors";
import { trackerReadTools } from "./read-tools";
import { trackerWriteTools } from "./write-tools";

export const trackerModule: ToolModule = {
  id: "tracker",
  name: "Project Tracker",
  instructions:
    "Talkpush implementation Project Tracker. Start with list_tracker_projects, then get_project_summary for 'where are we now'. " +
    "Refer to items and people by name; if a name is ambiguous the tool lists the candidates. Moving an item to blocked needs a blocker_reason. " +
    "There is no delete: use archive_item. Items and remarks you add are visible to the client unless you mark them internal.",
  tools: [...trackerReadTools, ...trackerWriteTools],
  isUserError: (err): err is Error => err instanceof TrackerError,
  logPrefix: "tracker-mcp",
};

/** Writes are logged as "Claude (MCP)" until callers can be told apart. */
const DEFAULT_CONTEXT: ToolContext = { actor: { label: "Claude (MCP)", via: "mcp" } };

export function createTrackerMcpServer(ctx: ToolContext = DEFAULT_CONTEXT) {
  return buildMcpServer({ name: trackerModule.name, version: "1.0.0" }, [trackerModule], ctx);
}
