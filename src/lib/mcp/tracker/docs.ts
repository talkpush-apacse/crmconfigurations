/** The generated tool list for the project-tracker-mcp skill. See src/lib/mcp/docs.ts. */

import { renderToolsMarkdown } from "@/lib/mcp/docs";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  ITEM_VISIBILITIES,
  PERSON_SIDES,
  PRIORITIES,
  PROJECT_STATUSES,
  REMARK_VISIBILITIES,
} from "@/lib/tracker/constants";
import { trackerModule } from "./index";

/** Path of the generated file, relative to the repository root. */
export const TRACKER_TOOLS_DOC_PATH = ".claude/skills/project-tracker-mcp/references/tools.md";

const list = (values: readonly string[], defaultValue?: string) =>
  values.map((v) => `\`${v}\`${v === defaultValue ? " (default)" : ""}`).join(", ");

export function renderTrackerToolsDoc(): string {
  return renderToolsMarkdown(
    trackerModule,
    `All tools accept a project by \`project_id\` or by \`project\` (title; add \`account\` only to tell two same-titled
projects apart). Item tools accept \`item_id\` or \`item\` (title, exact or unique partial match).`,
    [
      `- Item status: ${list(ITEM_STATUSES)}`,
      `- Item type: ${list(ITEM_TYPES)}`,
      `- Priority: ${list(PRIORITIES)}`,
      `- Item visibility: ${list(ITEM_VISIBILITIES, "client_visible")}`,
      `- Remark visibility: ${list(REMARK_VISIBILITIES, "internal")}`,
      `- Person side: ${list(PERSON_SIDES)}`,
      `- Project status: ${list(PROJECT_STATUSES)}`,
    ].join("\n")
  );
}
