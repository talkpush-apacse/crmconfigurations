import type { ChecklistJsonField, UserRow, CustomFieldDef, CustomData, CustomTab, IntegrationRow } from "./types";

export type SectionState = "complete" | "in-progress" | "not-started";

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
  fields: CustomFieldDef[],
  customData: CustomData | null,
): SectionState {
  if (!fields || fields.length === 0) return "not-started";
  if (!customData) return "not-started";

  const totalFields = fields.length;
  const filledFields = fields.filter((f) => {
    const val = customData[f.id];
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim() !== "";
    if (typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }).length;

  if (filledFields === 0) return "not-started";
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
  if (tab.columns !== undefined) return getCustomTableTabState(tab);
  return getCustomFieldTabState(tab.fields ?? [], customData);
}
