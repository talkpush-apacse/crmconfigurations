/**
 * The checklist tools that only look at data. A read-only login's Claude connection gets exactly these from the
 * checklist area and nothing else. A tool that is not listed here is treated as one that changes data, so a new
 * checklist tool is hidden from read-only connections until someone decides it is safe and adds it.
 * tests/roles.test.ts checks that every name here exists and that none of them sounds like a change.
 */
export const CHECKLIST_READ_TOOLS: ReadonlySet<string> = new Set([
  "list_checklists",
  "get_checklist",
  "get_checklist_progress",
  "get_section",
  "list_attachments",
  "fetch_attachment",
  "list_requirements_templates",
  "get_requirements_template",
  "list_custom_tabs",
  "preview_custom_tab",
  "get_configurator_checklist",
  "get_configurator_progress",
  "list_snapshots",
  "search",
  "fetch",
]);
