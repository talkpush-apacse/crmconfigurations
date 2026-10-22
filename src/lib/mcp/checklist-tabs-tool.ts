/**
 * CRM Config Checklist tool for choosing which tabs a checklist shows (update_checklist_tabs). The rules (valid tab names,
 * what counts as a change, the warnings) live in src/lib/checklists/tab-settings.ts. This file reads the saved settings,
 * applies the plan under a lock and records the change in the checklist's History as Claude.
 *
 * Turning a tab off only hides it. Nothing typed into it is touched, so turning it back on brings it all back.
 */

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { defineTool } from "@/lib/mcp/toolkit";
import { prisma } from "@/lib/db";
import { ChecklistToolError } from "@/lib/mcp/checklist-share-tools";
import { scheduleSaveRecord } from "@/lib/edit-history/record";
import { MCP_ACTOR } from "@/lib/edit-history/types";
import { TabSettingsError, describeTabs, planTabSettings, type TabSettingsPlan, type TabSettingsState } from "@/lib/checklists/tab-settings";
import { TAB_CONFIG, type FilledBy } from "@/lib/tab-config";
import type { CustomTab } from "@/lib/types";

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const STANDARD_LIST = TAB_CONFIG.map((t) => t.slug).join(", ");

type LockedRow = { id: string; version: number; fieldVersions: Record<string, number> | null };

export const updateChecklistTabsTool = defineTool({
  name: "update_checklist_tabs",
  description:
    "Choose which standard tabs a checklist shows, and optionally their order and who fills each one in. Use it so a checklist asks the client only for what is needed " +
    "(for example just Welcome plus one custom tab). " +
    `enabled_tabs is the FULL list of standard tabs that should be on; any standard tab you leave out is turned off. The standard tabs are: ${STANDARD_LIST}. ` +
    "Turning a tab off only hides it: nothing typed into it is deleted, and turning it back on (include it in enabled_tabs again) brings it all back. " +
    "Custom tabs are not part of enabled_tabs and are never turned off here; they stay as they are (remove one with delete_custom_tab). " +
    "Welcome can be turned off like any other tab; the reply warns when it is. At least one tab must stay on (a custom tab counts). " +
    "tab_order (optional) is the sidebar order, standard and custom tabs together (custom tabs are written custom-<name>); tabs you do not name keep their current order after the named ones. " +
    "filled_by (optional) is { tab: 'client' | 'talkpush' } for standard or custom tabs; 'talkpush' hides that tab from the client-facing view. Tabs you do not name keep their setting. " +
    "An unknown tab name stops the tool with the list of valid names and nothing is changed. " +
    "Safe to repeat: with the same input the second call changes nothing and says so. " +
    "Existing client links keep working and simply show the tabs that are now on. The change shows in the checklist's History as Claude. " +
    "The reply shows which tabs were on before and which are on now. It does not change any tab's content, generate configurator items or touch client links.",
  access: "write",
  input: {
    slug: z.string().describe("The checklist URL slug (see list_checklists), for example 'acme-corp'"),
    enabled_tabs: z
      .array(z.string())
      .describe("The full list of standard tab names that should be on, for example ['welcome']. Tabs not in the list are turned off."),
    tab_order: z
      .array(z.string())
      .optional()
      .describe("Optional sidebar order, standard and custom tab names together. Tabs not named keep their current order after the named ones."),
    filled_by: z
      .record(z.string(), z.enum(["client", "talkpush"]))
      .optional()
      .describe("Optional: who fills in each named tab, for example { 'messaging': 'talkpush' }. 'talkpush' hides the tab from the client view."),
  },
  handler: async ({ slug, enabled_tabs, tab_order, filled_by }) => {
    let applied: { plan: TabSettingsPlan; customTabs: CustomTab[]; version: number | null; clientName: string };
    try {
      applied = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<LockedRow[]>`SELECT id, version, "fieldVersions" FROM "Checklist" WHERE slug = ${slug} FOR UPDATE`;
        const current = locked[0];
        if (!current) throw new ChecklistToolError(`No checklist with the slug "${slug}". Use list_checklists to see the slugs.`);

        const row = await tx.checklist.findUniqueOrThrow({
          where: { id: current.id },
          select: { clientName: true, isCustom: true, archivedAt: true, enabledTabs: true, tabOrder: true, tabFilledBy: true, customTabs: true },
        });
        if (row.archivedAt) {
          throw new ChecklistToolError(`"${row.clientName}" is archived, so nothing was changed. Restore it from the checklist menu on the website first.`);
        }

        const state: TabSettingsState = {
          isCustom: row.isCustom,
          enabledTabs: (row.enabledTabs as string[] | null) ?? null,
          tabOrder: (row.tabOrder as string[] | null) ?? null,
          tabFilledBy: (row.tabFilledBy as Record<string, FilledBy> | null) ?? null,
          customTabs: (row.customTabs as unknown as CustomTab[] | null) ?? null,
        };
        const plan = planTabSettings(state, { enabledTabs: enabled_tabs, tabOrder: tab_order, filledBy: filled_by as Record<string, FilledBy> | undefined });
        const customTabs = state.customTabs ?? [];
        if (plan.unchanged) return { plan, customTabs, version: null, clientName: row.clientName };

        const newVersion = current.version + 1;
        const fieldVersions: Record<string, number> = { ...(current.fieldVersions ?? {}) };
        const data: Prisma.ChecklistUpdateInput = { version: newVersion };
        const historyFields: string[] = [];
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        if (plan.changed.enabledTabs) {
          data.enabledTabs = toJson(plan.next.enabledTabs);
          fieldVersions.enabledTabs = newVersion;
          historyFields.push("enabledTabs");
          before.enabledTabs = row.enabledTabs;
          after.enabledTabs = plan.next.enabledTabs;
        }
        if (plan.changed.tabOrder) {
          data.tabOrder = toJson(plan.next.tabOrder);
          fieldVersions.tabOrder = newVersion;
          historyFields.push("tabOrder");
          before.tabOrder = row.tabOrder;
          after.tabOrder = plan.next.tabOrder;
        }
        if (plan.changed.tabFilledBy) {
          data.tabFilledBy = toJson(plan.next.tabFilledBy);
          fieldVersions.tabFilledBy = newVersion;
          historyFields.push("tabFilledBy");
          before.tabFilledBy = row.tabFilledBy;
          after.tabFilledBy = plan.next.tabFilledBy;
        }
        data.fieldVersions = toJson(fieldVersions);
        await tx.checklist.update({ where: { id: current.id }, data });

        return { plan, customTabs, version: newVersion, clientName: row.clientName, history: { checklistId: current.id, fields: historyFields, before, after } };
      }).then((result) => {
        // Claude's change, recorded after it has committed (never part of the change itself).
        if ("history" in result && result.history && result.version !== null) {
          scheduleSaveRecord({ ...result.history, actor: MCP_ACTOR, version: result.version });
        }
        return result;
      });
    } catch (err) {
      if (err instanceof TabSettingsError) throw new ChecklistToolError(err.message);
      throw err;
    }

    const { plan, customTabs, version, clientName } = applied;
    const r = plan.report;
    const lines: string[] = [];
    if (r.turnedOn.length) lines.push(`Turned on: ${describeTabs(r.turnedOn)}.`);
    if (r.turnedOff.length) lines.push(`Turned off (hidden, nothing deleted): ${describeTabs(r.turnedOff)}.`);
    for (const c of r.filledByChanges) lines.push(`${describeTabs([c.tab], customTabs)} is now filled in by ${c.to === "talkpush" ? "Talkpush" : "the client"} (was ${c.from === "talkpush" ? "Talkpush" : "the client"}).`);
    if (plan.changed.tabOrder) lines.push("Changed the order of the tabs.");

    return {
      result: plan.unchanged ? "no_change" : "updated",
      slug,
      clientName,
      ...(version !== null ? { version } : {}),
      tabsOnBefore: r.tabsOnBefore,
      tabsOnNow: r.tabsOnNow,
      turnedOn: r.turnedOn,
      turnedOff: r.turnedOff,
      ...(r.filledByChanges.length ? { filledByChanges: r.filledByChanges } : {}),
      ...(r.order ? { tabOrder: r.order } : {}),
      customTabsUnchanged: r.customTabs,
      ...(r.warnings.length ? { warnings: r.warnings } : {}),
      note: plan.unchanged
        ? "Already set up this way, so nothing was changed."
        : `${lines.join(" ")} Everything typed into a turned-off tab is kept and comes back when it is turned on again. Client links keep working and show the tabs that are on.`,
    };
  },
});

export const checklistTabsTools = [updateChecklistTabsTool];
