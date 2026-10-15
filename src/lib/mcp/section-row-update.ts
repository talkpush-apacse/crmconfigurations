/**
 * Changing rows that already exist in a checklist section (sites, campaigns, users, ...), for Claude's
 * `update_section_rows` tool.
 *
 * Pure functions, no database: the tool reads the saved rows, calls `applyRowPatches`, and saves the result.
 * Nothing is applied unless EVERY patch is valid, so a typo in row 20 never leaves rows 1-19 half edited.
 */

export type FieldKind = "string" | "boolean" | "stringList";

/**
 * The fields Claude may change on each row-shaped section. This is what the `add_*` tools can set, so the rule is
 * "anything you could add, you can fix". Left out on purpose:
 *  - `id` and `deletedAt`: identity and the recoverable-delete marker are not edits.
 *  - the client's own sign-off (`approved`, `clientComments` on pre-screening, `notApplicable` on messaging):
 *    those record what the CLIENT decided, so Claude should not change them silently.
 */
export const EDITABLE_ROW_FIELDS = {
  users: {
    name: "string", accessType: "string", jobTitle: "string", email: "string", phone: "string",
    site: "string", reportsTo: "string", stage: "string", comments: "string",
  },
  campaigns: {
    campaignId: "string", nameInternal: "string", jobTitleExternal: "string", site: "string",
    jobDescription: "string", googleMapsLink: "string", zoomLink: "string",
    assignedRecruiters: "stringList", comments: "string",
  },
  sites: {
    siteName: "string", internalName: "string", lobsOrAccounts: "string", interviewHours: "string",
    interviewType: "string", fullAddress: "string", documentsToRing: "string", googleMapsLink: "string",
    comments: "string",
  },
  prescreening: {
    category: "string", question: "string", questionType: "string", answerOptions: "string",
    applicableCampaigns: "string", autoReject: "string", rejectCondition: "string", rejectReason: "string",
    comments: "string",
  },
  messaging: {
    name: "string", purpose: "string", language: "string", folder: "string", emailSubject: "string",
    emailTemplate: "string", emailActive: "boolean", smsTemplate: "string", smsActive: "boolean",
    whatsappTemplate: "string", whatsappActive: "boolean", messengerTemplate: "string",
    messengerActive: "boolean", comments: "string",
  },
  sources: { category: "string", subcategory: "string", link: "string", comments: "string" },
  folders: { folderName: "string", description: "string", movementType: "string", comments: "string" },
  attributes: {
    attributeName: "string", key: "string", description: "string", dataType: "string",
    suggestedValues: "string", addToAllFutureCandidates: "boolean", showAcrossApplications: "boolean",
    markDataPrivate: "boolean", restrictToOwners: "boolean", hideAttributeCompliance: "boolean",
    useSuggestedValuesOnly: "boolean", readOnlyMode: "boolean",
  },
  documents: {
    documentName: "string", applicableCandidates: "string", required: "string", blankTemplateLink: "string",
    applicableCampaigns: "string", accessPermissions: "string", folder: "string", comments: "string",
  },
  agencyPortal: {
    agencyName: "string", contactName: "string", email: "string", phone: "string", country: "string",
    comments: "string",
  },
  labels: { name: "string", color: "string" },
} as const satisfies Record<string, Record<string, FieldKind>>;

export type EditableSection = keyof typeof EDITABLE_ROW_FIELDS;

export const EDITABLE_SECTIONS = Object.keys(EDITABLE_ROW_FIELDS) as [EditableSection, ...EditableSection[]];

/** Most rows one call may change. Big enough for a whole sites list, small enough to review. */
export const MAX_ROWS_PER_CALL = 100;

export interface RowPatch {
  id: string;
  /** Only the fields to change. Fields not named here are left exactly as they are. */
  [field: string]: unknown;
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface RowChange {
  id: string;
  /** A name a person would recognise (the row's first text field), for the report. */
  label: string;
  changes: FieldChange[];
  /** True when every value sent already matched what was saved. */
  unchanged: boolean;
}

export interface PatchOutcome {
  rows: Array<Record<string, unknown>>;
  changes: RowChange[];
}

export class RowUpdateError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      problems.length === 1
        ? problems[0]
        : `${problems.length} problems, nothing was changed:\n${problems.map((p) => `- ${p}`).join("\n")}`
    );
    this.name = "RowUpdateError";
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function labelOf(section: EditableSection, row: Record<string, unknown>): string {
  for (const field of Object.keys(EDITABLE_ROW_FIELDS[section])) {
    const v = row[field];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return String(row.id);
}

function describeKind(kind: FieldKind): string {
  return kind === "stringList" ? "a list of text values" : kind === "boolean" ? "true or false" : "text";
}

function matchesKind(kind: FieldKind, value: unknown): boolean {
  if (kind === "string") return typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Applies `patches` to `existing`. Returns the new row list (same order, same rows, only the named fields changed)
 * plus a per-row report of old and new values. Throws `RowUpdateError` listing EVERY problem if any patch is invalid.
 */
export function applyRowPatches(
  section: EditableSection,
  existing: ReadonlyArray<Record<string, unknown>>,
  patches: ReadonlyArray<RowPatch>
): PatchOutcome {
  const fields: Record<string, FieldKind> = EDITABLE_ROW_FIELDS[section];
  const problems: string[] = [];

  if (patches.length === 0) throw new RowUpdateError(["Send at least one row to change."]);
  if (patches.length > MAX_ROWS_PER_CALL) {
    throw new RowUpdateError([`Too many rows (${patches.length}). Send at most ${MAX_ROWS_PER_CALL} per call.`]);
  }

  const byId = new Map(existing.map((row) => [String(row.id), row]));
  const seen = new Set<string>();
  const valid: Array<{ id: string; values: Record<string, unknown> }> = [];

  patches.forEach((patch, i) => {
    const where = `Row ${i + 1}`;
    const id = typeof patch.id === "string" ? patch.id.trim() : "";
    if (!id) {
      problems.push(`${where} has no \`id\`. Get ids with get_section on "${section}".`);
      return;
    }
    if (seen.has(id)) {
      problems.push(`${where}: id "${id}" appears more than once. Put all of a row's changes in one entry.`);
      return;
    }
    seen.add(id);

    const row = byId.get(id);
    if (!row) {
      problems.push(`${where}: no row with id "${id}" in "${section}". Use get_section to see the current ids.`);
      return;
    }
    const name = labelOf(section, row);
    if (row.deletedAt) {
      problems.push(`${where} ("${name}"): this row was deleted, so it cannot be edited.`);
      return;
    }

    const values: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(patch)) {
      if (field === "id") continue;
      const kind = fields[field];
      if (!kind) {
        problems.push(
          `${where} ("${name}"): "${field}" is not an editable field of ${section}. Editable fields: ${Object.keys(fields).join(", ")}.`
        );
        continue;
      }
      if (!matchesKind(kind, value)) {
        problems.push(`${where} ("${name}"): "${field}" must be ${describeKind(kind)}.`);
        continue;
      }
      values[field] = value;
    }
    if (Object.keys(values).length === 0 && !problems.some((p) => p.startsWith(`${where} `))) {
      problems.push(`${where} ("${name}") names no fields to change.`);
    }
    valid.push({ id, values });
  });

  if (problems.length > 0) throw new RowUpdateError(problems);

  const patchById = new Map(valid.map((v) => [v.id, v.values]));
  const changes: RowChange[] = [];
  const rows = existing.map((row) => {
    const values = patchById.get(String(row.id));
    if (!values) return row;
    const fieldChanges: FieldChange[] = [];
    for (const [field, to] of Object.entries(values)) {
      if (!sameValue(row[field], to)) fieldChanges.push({ field, from: row[field] ?? null, to });
    }
    changes.push({
      id: String(row.id),
      label: labelOf(section, row),
      changes: fieldChanges,
      unchanged: fieldChanges.length === 0,
    });
    return fieldChanges.length === 0 ? row : { ...row, ...values };
  });

  return { rows, changes };
}
