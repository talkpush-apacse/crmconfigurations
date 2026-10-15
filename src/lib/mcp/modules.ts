/**
 * Every MCP module the app can serve. A connector is a list of these modules.
 * To add a whole new area (for example reporting), create src/lib/mcp/<area>/index.ts exporting a
 * ToolModule and add it here.
 */

import { EditLinkError } from "@/lib/edit-history/links-service";
import { registerChecklistTools } from "@/lib/mcp-server";
import { CHECKLIST_READ_TOOLS } from "./checklist-read-tools";
import { ChecklistToolError, checklistShareTools } from "./checklist-share-tools";
import type { ToolModule } from "./toolkit";
import { trackerModule } from "./tracker";

/**
 * Checklist tools are still registered the original way (46 tools); they are served unchanged. The client-link tools
 * are the first ones written with defineTool; they are offered on the combined connector (/api/mcp/all), which knows
 * the address to build links on.
 */
export const checklistModule: ToolModule = {
  id: "checklist",
  name: "CRM Config Checklist",
  instructions:
    "Client links for a checklist (create_checklist_link, list_checklist_links, change_checklist_link) are ONLY for when the user explicitly asks. " +
    "level view = read-only, level edit = can change the checklist (give a name to record one person's changes under their name). " +
    "Nothing is emailed: hand the user the address to copy and send themselves.",
  tools: checklistShareTools,
  legacy: registerChecklistTools,
  legacyReadTools: CHECKLIST_READ_TOOLS,
  isUserError: (err): err is Error => err instanceof ChecklistToolError || err instanceof EditLinkError,
  logPrefix: "checklist-mcp",
};

export const MCP_MODULES: ToolModule[] = [checklistModule, trackerModule];
