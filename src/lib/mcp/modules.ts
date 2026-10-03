/**
 * Every MCP module the app can serve. A connector is a list of these modules.
 * To add a whole new area (for example reporting), create src/lib/mcp/<area>/index.ts exporting a
 * ToolModule and add it here.
 */

import { registerChecklistTools } from "@/lib/mcp-server";
import type { ToolModule } from "./toolkit";
import { trackerModule } from "./tracker";

/** Checklist tools are still registered the original way (46 tools); they are served unchanged. */
export const checklistModule: ToolModule = {
  id: "checklist",
  name: "CRM Config Checklist",
  tools: [],
  legacy: registerChecklistTools,
};

export const MCP_MODULES: ToolModule[] = [checklistModule, trackerModule];
