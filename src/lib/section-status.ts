import { excludeTalkpushTabs, getEnabledTabs } from "./tab-config";
import type {
  ChecklistData,
  ChecklistJsonField,
  UserRow,
  CustomFieldDef,
  CustomData,
  CustomTab,
  IntegrationRow,
} from "./types";
import {
  getCustomFieldKey,
  getCustomTabFormValues,
  getCustomTabMode,
  isCustomFieldVisible,
  validateCustomFormValues,
} from "./custom-tab-service";

export type SectionState = "complete" | "in-progress" | "not-started";

export interface ChecklistProgressSection {
  slug: string;
  label: string;
  status: SectionState;
}

export interface ChecklistProgressSummary {
  sections: ChecklistProgressSection[];
  completeCount: number;
  inProgressCount: number;
  notStartedCount: number;
  startedCount: number;
  totalCount: number;
  completionPercent: number;
  status: SectionState;
}

const USER_EDITABLE_FIELDS: (keyof UserRow)[] = [
  "name",
  "accessType",
  "jobTitle",
  "email",
  "phone",
  "site",
  "reportsTo",
  "comments",
];

const USER_REQUIRED_FIELDS: (keyof UserRow)[] = [
  "name",
  "accessType",
  "email",
  "phone",
];

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  return value !== "" && value !== null && value !== undefined;
}

function getObjectValues(
  obj: Record<string, unknown>,
  ignoredKeys: string[] = []
): unknown[] {
  return Object.entries(obj)
    .filter(([key]) => !ignoredKeys.includes(key))
    .map(([, value]) => value);
}

function isUserRowActive(row: UserRow): boolean {
  return USER_EDITABLE_FIELDS.some((field) => hasMeaningfulValue(row[field]));
}

function hasRequiredUserFields(row: UserRow): boolean {
  return USER_REQUIRED_FIELDS.every((field) => hasMeaningfulValue(row[field]));
}

function getUserSectionState(val: unknown): SectionState {
  if (!Array.isArray(val) || val.length === 0) return "not-started";

  const activeRows = val.filter(
    (row): row is UserRow =>
      typeof row === "object" &&
      row !== null &&
      isUserRowActive(row as UserRow)
  );

  if (activeRows.length === 0) return "not-started";
  return activeRows.every((row) => hasRequiredUserFields(row))
    ? "complete"
    : "in-progress";
}

function hasInstanceConfigValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(hasInstanceConfigValue);
  if (typeof value === "object" && value !== null) {
    return getObjectValues(value as Record<string, unknown>).some(hasInstanceConfigValue);
  }
  return value !== null && value !== undefined;
}

function isIntegrationRowActive(row: IntegrationRow): boolean {
  return getObjectValues(row as unknown as Record<string, unknown>, ["id"]).some((value) => {
    if (Array.isArray(value)) return value.some(hasInstanceConfigValue);
    if (typeof value === "object" && value !== null) return hasInstanceConfigValue(value);
    return hasMeaningfulValue(value);
  });
}

function hasRequiredIntegrationFields(row: IntegrationRow): boolean {
  return ["vendorName", "vendorCategory", "actionType", "triggerFolder"].every((field) =>
    hasMeaningfulValue(row[field as keyof IntegrationRow])
  );
}

function getIntegrationsSectionState(val: unknown): SectionState {
  if (!Array.isArray(val) || val.length === 0) return "not-started";

  const activeRows = val.filter(
    (row): row is IntegrationRow =>
      typeof row === "object" &&
      row !== null &&
      isIntegrationRowActive(row as IntegrationRow)
  );

  if (activeRows.length === 0) return "not-started";
  if (activeRows.length >= 2 && activeRows.every(hasRequiredIntegrationFields)) return "complete";
  return "in-progress";
}

/**
 * Computes the completion state of a single checklist section's data value.
 * Used in the client layout (nav dots) and WelcomeSheet (progress chips).
 * Single source of truth — do not duplicate this logic elsewhere.
 */
export function getSectionState(
  val: unknown,
  sectionKey?: ChecklistJsonField | null
): SectionState {
  if (val === null || val === undefined) return "not-started";

  if (sectionKey === "users") {
    return getUserSectionState(val);
  }

  if (sectionKey === "integrations") {
    return getIntegrationsSectionState(val);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return "not-started";

    // Rows the user removed or marked not applicable are not work in progress.
    //
    // Soft-deleted rows were being counted as filled: `deletedAt` is itself a
    // value, so a deleted row looked "non-empty" and kept inflating the count
    // for every section that soft-deletes.
    const live = val.filter(
      (item) =>
        !(
          typeof item === "object" &&
          item !== null &&
          ((item as Record<string, unknown>).deletedAt ||
            (item as Record<string, unknown>).notApplicable)
        )
    );
    if (live.length === 0) return "not-started";

    const nonEmpty = live.filter((item) =>
      typeof item === "object" && item !== null
        ? getObjectValues(item as Record<string, unknown>, [
            "id",
            "deletedAt",
            "deletedBy",
            "notApplicable",
          ]).some(hasMeaningfulValue)
        : hasMeaningfulValue(item)
    );
    return nonEmpty.length >= 3 ? "complete" : "in-progress";
  }

  if (typeof val === "object") {
    const values = getObjectValues(val as Record<string, unknown>);
    if (values.length === 0) return "not-started";
    const filled = values.filter(hasMeaningfulValue).length;
    if (filled === 0) return "not-started";
    return filled / values.length >= 0.6 ? "complete" : "in-progress";
  }

  return "in-progress";
}

/**
 * Computes the completion state of a form-based custom tab (CustomTab.fields
 * + the shared customData bag).
 */
function getCustomFieldTabState(
  tabOrFields: CustomTab | CustomFieldDef[],
  customData: CustomData | null,
): SectionState {
  const tab = Array.isArray(tabOrFields) ? null : tabOrFields;
  const fields = Array.isArray(tabOrFields) ? tabOrFields : (tabOrFields.fields ?? []);
  if (!fields || fields.length === 0) return "not-started";
  if (!customData) return "not-started";
  const values = tab ? getCustomTabFormValues(tab, customData) : customData;
  const visibleFields = fields.filter((field) => isCustomFieldVisible(field, values));

  const totalFields = visibleFields.length;
  const filledFields = visibleFields.filter((f) => {
    const val = values[getCustomFieldKey(f)];
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim() !== "";
    if (typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return true;
  }).length;

  if (filledFields === 0) return "not-started";
  if (tab && validateCustomFormValues(tab, values).valid) return "complete";
  return filledFields >= totalFields ? "complete" : "in-progress";
}

/**
 * Computes the completion state of a table-based custom tab (CustomTab.columns
 * + CustomTab.rows). A row counts as active once any of its cells has a value;
 * the tab is complete when every active row has all its required columns filled.
 * An attached reference spreadsheet alone counts as in-progress, matching how
 * tab uploads are treated elsewhere.
 */
function getCustomTableTabState(tab: CustomTab): SectionState {
  const columns = tab.columns ?? [];
  const rows = tab.rows ?? [];
  if (columns.length === 0) return "not-started";

  const activeRows = rows.filter((row) =>
    columns.some((col) => hasMeaningfulValue(row[col.key])),
  );

  if (activeRows.length === 0) {
    return tab.uploadedFile ? "in-progress" : "not-started";
  }

  const requiredColumns = columns.filter((col) => col.required);
  const allRequiredFilled = activeRows.every((row) =>
    requiredColumns.every((col) => hasMeaningfulValue(row[col.key])),
  );

  return allRequiredFilled ? "complete" : "in-progress";
}

/**
 * Computes the completion state of a custom tab, whichever shape it takes.
 *
 * Table-based tabs (created via MCP or spreadsheet import) carry `columns`;
 * form-based tabs (created in the admin Settings dialog) carry `fields` and
 * store their values in the shared `customData` bag.
 */
export function getCustomTabSectionState(
  tab: CustomTab,
  customData: CustomData | null,
): SectionState {
  if (getCustomTabMode(tab) === "table") return getCustomTableTabState(tab);
  return getCustomFieldTabState(tab, customData);
}

export function getChecklistProgress(
  data: ChecklistData,
  {
    includeAdminTabs = false,
    clientView = false,
  }: {
    includeAdminTabs?: boolean;
    clientView?: boolean;
  } = {},
): ChecklistProgressSummary {
  const customData = (data.customData as CustomData | null) ?? null;
  const customTabs = (data.customTabs as CustomTab[] | null) ?? null;

  const sections: ChecklistProgressSection[] = data.isCustom
    ? [
        {
          slug: "custom",
          label: "Custom Checklist",
          status: getCustomFieldTabState(data.customSchema ?? [], customData),
        },
      ]
    : (clientView
        ? excludeTalkpushTabs(
            getEnabledTabs(
              data.enabledTabs ?? null,
              includeAdminTabs,
              data.tabOrder ?? null,
              customTabs,
              data.tabFilledBy ?? null,
            ),
          )
        : getEnabledTabs(
            data.enabledTabs ?? null,
            includeAdminTabs,
            data.tabOrder ?? null,
            customTabs,
            data.tabFilledBy ?? null,
          )
      )
        .filter((tab) => tab.dataKey || tab.customTabId)
        .map((tab) => {
          let status: SectionState = "not-started";
          if (tab.customTabId) {
            const customTab = customTabs?.find((candidate) => candidate.id === tab.customTabId);
            status = customTab ? getCustomTabSectionState(customTab, customData) : "not-started";
          } else if (tab.dataKey) {
            status = getSectionState(data[tab.dataKey as keyof ChecklistData], tab.dataKey);
          }
          return { slug: tab.slug, label: tab.label, status };
        });

  const completeCount = sections.filter((section) => section.status === "complete").length;
  const inProgressCount = sections.filter((section) => section.status === "in-progress").length;
  const notStartedCount = sections.filter((section) => section.status === "not-started").length;
  const totalCount = sections.length;
  const startedCount = completeCount + inProgressCount;
  const completionPercent = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;
  const status: SectionState =
    totalCount > 0 && completeCount === totalCount
      ? "complete"
      : startedCount > 0
        ? "in-progress"
        : "not-started";

  return {
    sections,
    completeCount,
    inProgressCount,
    notStartedCount,
    startedCount,
    totalCount,
    completionPercent,
    status,
  };
}
