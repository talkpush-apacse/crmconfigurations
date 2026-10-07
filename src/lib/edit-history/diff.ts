import { TAB_CONFIG } from "@/lib/tab-config";
import type { CustomTab, CustomTabColumn } from "@/lib/types";
import {
  MAX_CELL_EVENTS_PER_FIELD,
  MAX_CHARS_PER_SAVE,
  MAX_VALUE_CHARS,
  type DraftEvent,
  type EditChangeType,
} from "./types";

/**
 * Works out WHAT changed between the saved checklist and the new one: one line per cell (row + column), per added or
 * removed row, per list item, or per setup change. Pure code (no database), so it can be tested on its own.
 *
 * Rules that matter:
 *  - Passwords, keys, secrets and webhooks are never copied into the history (value hidden, the fact of the change kept).
 *  - Admin settings and integrations are recorded as "changed", never with their values.
 *  - Rows are matched by their `id`, so moving or inserting a row does not look like every row changed.
 *  - A row with a `deletedAt` stamp is recorded as deleted / restored, not as an edit of its cells.
 *  - One field with more than 25 cell changes (a CSV import, a paste) collapses to one "replaced" line.
 *  - Labels for custom tabs come from the tab's own column order (the database does not keep object key order).
 */

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const hasOwn = (o: unknown, k: string) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);

/** JSON with keys in a fixed order, so two objects with the same content compare equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** null, undefined, "", whitespace, [] and {} all mean "nothing there". */
function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (isRecord(v)) return Object.keys(v).length === 0;
  return false;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  return stable(a) === stable(b);
}

const SENSITIVE_KEY = /pass(word|code)?|secret|api[-_ ]?key|token|webhook|openai|credential/i;
export const isSensitiveKey = (key: string) => SENSITIVE_KEY.test(key);

/** "companyAddress" -> "Company address". */
export function humanise(key: string): string {
  const words = key
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A value made safe to store: file objects keep only their name, long text is cut. */
function shorten(value: unknown): { value: unknown; truncated: boolean } {
  if (value === undefined) return { value: undefined, truncated: false };
  let v = value;
  if (isRecord(v) && typeof v.url === "string") {
    const name = typeof v.name === "string" ? v.name : typeof v.fileName === "string" ? v.fileName : "file";
    v = { name };
  }
  if (typeof v === "string") {
    return v.length > MAX_VALUE_CHARS ? { value: v.slice(0, MAX_VALUE_CHARS), truncated: true } : { value: v, truncated: false };
  }
  if (v !== null && typeof v === "object") {
    const text = JSON.stringify(v);
    return text.length > MAX_VALUE_CHARS ? { value: text.slice(0, MAX_VALUE_CHARS), truncated: true } : { value: v, truncated: false };
  }
  return { value: v, truncated: false };
}

const META_KEYS = new Set(["id", "createdAt", "updatedAt", "deletedAt", "deletedBy", "sortOrder"]);

const PREFERRED_LABEL_KEYS = [
  "name", "label", "title", "question", "faq", "agencyName", "siteName", "campaignName", "templateName",
  "folderName", "attributeName", "sourceName", "documentName", "email", "userName", "firstName", "reason",
];

function textOf(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** A short name for a row, from named columns when the tab defines them, otherwise from familiar keys. */
function labelRow(row: Rec, columnOrder?: string[]): string | null {
  const parts: string[] = [];
  if (columnOrder) {
    // The first filled-in column names the row. A second one is added only when both are short, so a long call
    // script or paragraph never becomes the row's name.
    for (const key of columnOrder) {
      const t = textOf(row[key]);
      if (!t || isSensitiveKey(key)) continue;
      if (parts.length === 0) parts.push(t);
      else if (parts[0].length <= 30 && t.length <= 30) parts.push(t);
      if (parts.length >= 2 || parts[0].length > 30) break;
    }
  } else {
    for (const key of PREFERRED_LABEL_KEYS) {
      const t = textOf(row[key]);
      if (t) {
        parts.push(t);
        break;
      }
    }
    if (parts.length === 0) {
      for (const key of Object.keys(row).sort()) {
        if (META_KEYS.has(key) || isSensitiveKey(key)) continue;
        const t = textOf(row[key]);
        if (t) {
          parts.push(t);
          break;
        }
      }
    }
  }
  return parts.length ? clip(parts.join(" · "), 80) : null;
}

function compactRow(row: Rec): { value: unknown; truncated: boolean } {
  const cells: Rec = {};
  let hidden = false;
  for (const key of Object.keys(row).sort()) {
    if (META_KEYS.has(key) || isEmpty(row[key])) continue;
    if (isSensitiveKey(key)) {
      hidden = true;
      continue;
    }
    cells[key] = shorten(row[key]).value;
  }
  const out = shorten(cells);
  return { value: out.value, truncated: out.truncated || hidden };
}

// ---------------------------------------------------------------------------------------------------------------

interface TabRef {
  key: string;
  label: string;
}

interface RowSpec {
  labelRow: (row: Rec) => string | null;
  labelCol: (key: string) => string;
}

class Collector {
  events: DraftEvent[] = [];

  push(tab: TabRef, e: Omit<DraftEvent, "tabKey" | "tabLabel" | "subject" | "truncated"> & { truncated?: boolean }) {
    this.events.push({
      tabKey: tab.key,
      tabLabel: tab.label,
      rowId: e.rowId,
      rowLabel: e.rowLabel,
      fieldKey: e.fieldKey,
      fieldLabel: e.fieldLabel,
      changeType: e.changeType,
      summary: e.summary,
      before: e.before,
      after: e.after,
      truncated: e.truncated ?? false,
      subject: `${tab.key}|${e.rowId ?? ""}|${e.fieldKey ?? ""}|${e.changeType}`,
    });
  }

  /** Per top-level field: too many small changes collapse into one line. */
  closeField(tab: TabRef, startIndex: number) {
    const mine = this.events.slice(startIndex);
    if (mine.length <= MAX_CELL_EVENTS_PER_FIELD) return;
    this.events.length = startIndex;
    this.push(tab, {
      rowId: null,
      rowLabel: null,
      fieldKey: null,
      fieldLabel: null,
      changeType: "replaced",
      summary: `Changed ${mine.length} items in ${tab.label}`,
      truncated: true,
    });
  }
}

function pushCell(
  c: Collector,
  tab: TabRef,
  p: { rowId: string | null; rowLabel: string | null; fieldKey: string; fieldLabel: string; before: unknown; after: unknown }
) {
  const where = p.rowLabel ? ` in "${p.rowLabel}"` : "";
  if (isSensitiveKey(p.fieldKey)) {
    // Deliberately not `...p`: that would carry the raw before/after values into the event.
    c.push(tab, {
      rowId: p.rowId,
      rowLabel: p.rowLabel,
      fieldKey: p.fieldKey,
      fieldLabel: p.fieldLabel,
      changeType: "edited",
      summary: `Changed ${p.fieldLabel}${where} (value not recorded)`,
      truncated: true,
    });
    return;
  }
  const b = shorten(p.before);
  const a = shorten(p.after);
  c.push(tab, {
    rowId: p.rowId,
    rowLabel: p.rowLabel,
    fieldKey: p.fieldKey,
    fieldLabel: p.fieldLabel,
    changeType: "edited",
    summary: `Changed ${p.fieldLabel}${where}`,
    before: b.value,
    after: a.value,
    truncated: b.truncated || a.truncated,
  });
}

function isRowArray(v: unknown): v is Rec[] {
  return Array.isArray(v) && v.length > 0 && v.every((r) => isRecord(r) && typeof r.id === "string");
}
const rowCompatible = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && (v.length === 0 || isRowArray(v)));
const asRows = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);

function diffRows(c: Collector, tab: TabRef, path: string[], bRows: Rec[], aRows: Rec[], spec: RowSpec) {
  const prefix = path.join(".");
  const bMap = new Map(bRows.map((r) => [r.id as string, r]));
  const aMap = new Map(aRows.map((r) => [r.id as string, r]));

  for (const row of aRows) {
    const id = row.id as string;
    const old = bMap.get(id);
    const label = spec.labelRow(row);
    if (!old) {
      const compact = compactRow(row);
      c.push(tab, {
        rowId: id, rowLabel: label, fieldKey: prefix || null, fieldLabel: null, changeType: "added",
        summary: label ? `Added "${label}"` : "Added a row", after: compact.value, truncated: compact.truncated,
      });
      continue;
    }
    const wasDeleted = !!old.deletedAt;
    const isDeleted = !!row.deletedAt;
    if (!wasDeleted && isDeleted) {
      c.push(tab, {
        rowId: id, rowLabel: spec.labelRow(old) ?? label, fieldKey: prefix || null, fieldLabel: null, changeType: "deleted",
        summary: `Deleted "${spec.labelRow(old) ?? label ?? "a row"}"`,
      });
      continue;
    }
    if (wasDeleted && !isDeleted) {
      c.push(tab, {
        rowId: id, rowLabel: label, fieldKey: prefix || null, fieldLabel: null, changeType: "restored",
        summary: `Restored "${label ?? "a row"}"`,
      });
    }
    if (isDeleted) continue;
    const keys = Array.from(new Set([...Object.keys(old), ...Object.keys(row)])).filter((k) => !META_KEYS.has(k)).sort();
    for (const key of keys) {
      if (sameValue(old[key], row[key])) continue;
      pushCell(c, tab, {
        rowId: id,
        rowLabel: label,
        fieldKey: prefix ? `${prefix}.${key}` : key,
        fieldLabel: spec.labelCol(key),
        before: old[key],
        after: row[key],
      });
    }
  }

  for (const old of bRows) {
    const id = old.id as string;
    if (aMap.has(id)) continue;
    const label = spec.labelRow(old);
    const compact = compactRow(old);
    c.push(tab, {
      rowId: id, rowLabel: label, fieldKey: prefix || null, fieldLabel: null, changeType: "deleted",
      summary: label ? `Deleted "${label}"` : "Deleted a row", before: compact.value, truncated: compact.truncated,
    });
  }

  // Order: compare only the rows both sides have, so adding or removing a row is not also a "reorder".
  const common = bRows.map((r) => r.id as string).filter((id) => aMap.has(id));
  const commonA = aRows.map((r) => r.id as string).filter((id) => bMap.has(id));
  if (common.length > 1 && common.join("\u0000") !== commonA.join("\u0000")) {
    c.push(tab, {
      rowId: null, rowLabel: null, fieldKey: prefix || null, fieldLabel: null, changeType: "reordered",
      summary: "Changed the order of the rows",
    });
  }
}

function diffList(c: Collector, tab: TabRef, path: string[], b: unknown, a: unknown) {
  const bl = Array.isArray(b) ? b : [];
  const al = Array.isArray(a) ? a : [];
  const fieldKey = path.join(".");
  const fieldLabel = humanise(path[path.length - 1] ?? tab.label);
  const allPrimitive = [...bl, ...al].every((x) => x === null || ["string", "number", "boolean"].includes(typeof x));
  if (!allPrimitive) {
    pushCell(c, tab, { rowId: null, rowLabel: null, fieldKey, fieldLabel, before: bl, after: al });
    return;
  }
  const remaining = new Map<string, number>();
  for (const x of bl) remaining.set(String(x), (remaining.get(String(x)) ?? 0) + 1);
  const added: unknown[] = [];
  for (const x of al) {
    const key = String(x);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else added.push(x);
  }
  const removed: unknown[] = [];
  for (const x of bl) {
    const left = remaining.get(String(x)) ?? 0;
    if (left > 0) {
      removed.push(x);
      remaining.set(String(x), left - 1);
    }
  }
  for (const x of removed) {
    c.push(tab, {
      rowId: null, rowLabel: clip(String(x), 80), fieldKey, fieldLabel, changeType: "deleted",
      summary: `Removed "${clip(String(x), 80)}" from ${fieldLabel}`, before: shorten(x).value,
    });
  }
  for (const x of added) {
    c.push(tab, {
      rowId: null, rowLabel: clip(String(x), 80), fieldKey, fieldLabel, changeType: "added",
      summary: `Added "${clip(String(x), 80)}" to ${fieldLabel}`, after: shorten(x).value,
    });
  }
  if (removed.length === 0 && added.length === 0 && stable(bl) !== stable(al)) {
    c.push(tab, {
      rowId: null, rowLabel: null, fieldKey, fieldLabel, changeType: "reordered",
      summary: `Changed the order of ${fieldLabel}`,
    });
  }
}

const STANDARD_ROW_SPEC: RowSpec = { labelRow: (row) => labelRow(row), labelCol: humanise };

function standardWalk(c: Collector, tab: TabRef, path: string[], b: unknown, a: unknown) {
  if (sameValue(b, a)) return;
  if ((isRowArray(b) || isRowArray(a)) && rowCompatible(b) && rowCompatible(a)) {
    diffRows(c, tab, path, asRows(b), asRows(a), STANDARD_ROW_SPEC);
    return;
  }
  if (Array.isArray(b) || Array.isArray(a)) {
    diffList(c, tab, path, b, a);
    return;
  }
  if (isRecord(b) || isRecord(a)) {
    const left = isRecord(b) ? b : {};
    const right = isRecord(a) ? a : {};
    for (const key of Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()) {
      standardWalk(c, tab, [...path, key], left[key], right[key]);
    }
    return;
  }
  // A single value (text, number, yes/no).
  const key = path.join(".") || tab.key;
  pushCell(c, tab, {
    rowId: null, rowLabel: null, fieldKey: key, fieldLabel: humanise(path[path.length - 1] ?? tab.label), before: b, after: a,
  });
}

// ---- custom tabs ----------------------------------------------------------------------------------------------

const customTabRef = (tab: CustomTab): TabRef => ({ key: `custom-${tab.slug}`, label: tab.label });
const fieldKeyOf = (f: { key?: string; id: string }) => f.key || f.id;

function customRowSpec(tab: CustomTab): RowSpec {
  const columns: CustomTabColumn[] = tab.columns ?? [];
  // Short-text columns name a row. Long text (call scripts, paragraphs) never does, so editing a script
  // does not change the name the history shows for its row.
  const short = columns.filter((col) => ["text", "email", "url", "select"].includes(col.type)).map((col) => col.key);
  const order = short.length ? short : columns.filter((col) => col.type !== "textarea").map((col) => col.key);
  return {
    labelRow: (row) => labelRow(row, order.length ? order : undefined),
    labelCol: (key) => columns.find((col) => col.key === key)?.label ?? humanise(key),
  };
}

function diffCustomTabs(c: Collector, b: unknown, a: unknown) {
  const bTabs = Array.isArray(b) ? (b as CustomTab[]).filter((t) => isRecord(t) && typeof t.id === "string") : [];
  const aTabs = Array.isArray(a) ? (a as CustomTab[]).filter((t) => isRecord(t) && typeof t.id === "string") : [];
  const bMap = new Map(bTabs.map((t) => [t.id, t]));
  const aMap = new Map(aTabs.map((t) => [t.id, t]));

  for (const tab of aTabs) {
    const old = bMap.get(tab.id);
    const ref = customTabRef(tab);
    if (!old) {
      c.push(ref, {
        rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null, changeType: "added",
        summary: `Created the tab "${tab.label}"`,
      });
      continue;
    }
    const strip = (t: CustomTab) => ({ ...t, rows: undefined, uploadedFile: undefined, sortOrder: undefined });
    if (stable(strip(old)) !== stable(strip(tab))) {
      c.push(ref, {
        rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null, changeType: "setup",
        summary:
          old.label !== tab.label
            ? `Renamed the tab "${old.label}" to "${tab.label}"`
            : "Changed the setup of this tab (columns, fields or help text)",
        before: old.label !== tab.label ? old.label : undefined,
        after: old.label !== tab.label ? tab.label : undefined,
      });
    }
    if (!sameValue(old.rows, tab.rows)) {
      const spec = customRowSpec(tab);
      if (rowCompatible(old.rows) && rowCompatible(tab.rows)) {
        diffRows(c, ref, [], asRows(old.rows), asRows(tab.rows), spec);
      } else {
        pushCell(c, ref, { rowId: null, rowLabel: null, fieldKey: "rows", fieldLabel: "Rows", before: old.rows, after: tab.rows });
      }
    }
    if (!sameValue(old.uploadedFile, tab.uploadedFile)) {
      const newName = tab.uploadedFile?.name;
      c.push(ref, {
        rowId: null, rowLabel: null, fieldKey: "uploadedFile", fieldLabel: "Attached file", changeType: "file",
        summary: newName ? `Attached the file "${clip(newName, 80)}"` : "Removed the attached file",
        before: old.uploadedFile?.name, after: newName,
      });
    }
  }
  for (const tab of bTabs) {
    if (aMap.has(tab.id)) continue;
    c.push(customTabRef(tab), {
      rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null, changeType: "deleted",
      summary: `Deleted the tab "${tab.label}"`,
    });
  }
}

const FORM_TAB: TabRef = { key: "custom-form", label: "Custom form" };

function diffCustomData(c: Collector, b: unknown, a: unknown, tabs: CustomTab[]) {
  const left = isRecord(b) ? b : {};
  const right = isRecord(a) ? a : {};
  const findFieldAnywhere = (key: string) => {
    for (const tab of tabs) {
      const f = (tab.fields ?? []).find((x) => fieldKeyOf(x) === key || x.id === key);
      if (f) return { tab, field: f };
    }
    return null;
  };

  for (const k of Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()) {
    const lv = left[k];
    const rv = right[k];
    const container = (isRecord(lv) && isRecord(lv.values)) || (isRecord(rv) && isRecord(rv.values));
    if (container) {
      const tab = tabs.find((t) => t.id === k);
      const ref = tab ? customTabRef(tab) : FORM_TAB;
      const lvals = isRecord(lv) && isRecord(lv.values) ? lv.values : {};
      const rvals = isRecord(rv) && isRecord(rv.values) ? rv.values : {};
      for (const fk of Array.from(new Set([...Object.keys(lvals), ...Object.keys(rvals)])).sort()) {
        if (sameValue(lvals[fk], rvals[fk])) continue;
        const field = tab?.fields?.find((f) => fieldKeyOf(f) === fk || f.id === fk);
        pushCell(c, ref, {
          rowId: null, rowLabel: null, fieldKey: fk, fieldLabel: field?.label ?? humanise(fk), before: lvals[fk], after: rvals[fk],
        });
      }
      continue;
    }
    if (sameValue(lv, rv)) continue;
    const hit = findFieldAnywhere(k);
    pushCell(c, hit ? customTabRef(hit.tab) : FORM_TAB, {
      rowId: null, rowLabel: null, fieldKey: k, fieldLabel: hit?.field.label ?? humanise(k), before: lv, after: rv,
    });
  }
}

// ---- the other fields -----------------------------------------------------------------------------------------

/** Recorded as "changed" with no values at all. */
const VALUELESS_FIELDS: Record<string, string> = {
  adminSettings: "Changed the admin settings (values are not recorded)",
  integrations: "Changed the integrations (values are not recorded)",
  atsIntegrations: "Changed the ATS integrations (values are not recorded)",
};

/** Checklist setup the admin controls: one line, no values. */
const SETUP_FIELDS: Record<string, string> = {
  enabledTabs: "Changed which tabs are turned on",
  tabOrder: "Changed the order of the tabs",
  tabFilledBy: "Changed who fills in which tab",
  communicationChannels: "Changed the communication channels",
  featureToggles: "Changed the feature toggles",
  customSchema: "Changed the custom form setup",
};

function tabForField(field: string): TabRef {
  const hit = TAB_CONFIG.find((t) => t.dataKey === field);
  return { key: field, label: hit?.label ?? humanise(field) };
}

function diffUploadMeta(c: Collector, b: unknown, a: unknown) {
  const left = isRecord(b) ? b : {};
  const right = isRecord(a) ? a : {};
  for (const k of Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()) {
    if (sameValue(left[k], right[k])) continue;
    const tab = tabForField(k);
    const before = (isRecord(left[k]) && Array.isArray(left[k].uploadedFiles) ? (left[k].uploadedFiles as unknown[]).length : 0);
    const after = (isRecord(right[k]) && Array.isArray(right[k].uploadedFiles) ? (right[k].uploadedFiles as unknown[]).length : 0);
    c.push(tab, {
      rowId: null, rowLabel: null, fieldKey: "attachments", fieldLabel: "Attachments", changeType: "file",
      summary:
        after > before ? "Attached a file" : after < before ? "Removed an attached file" : "Changed the attachment or \"skip\" setting",
    });
  }
}

export interface DiffInput {
  /** What is saved now, for at least the fields being changed (and customTabs, for labels). */
  before: Rec;
  /** The new values, as sent. */
  after: Rec;
  /** The fields this save changes. */
  fields: readonly string[];
}

/** Everything that changed in one save, shortened and ready to store. Empty when nothing really changed. */
export function diffChecklistFields(input: DiffInput): DraftEvent[] {
  const { before, after, fields } = input;
  const c = new Collector();
  const tabsAfter = (hasOwn(after, "customTabs") ? after.customTabs : before.customTabs) as unknown;
  const labelTabs = Array.isArray(tabsAfter) ? (tabsAfter as CustomTab[]) : [];

  for (const field of fields) {
    const b = before[field];
    const a = hasOwn(after, field) ? after[field] : b;
    if (sameValue(b, a)) continue;
    const start = c.events.length;
    const tab = tabForField(field);

    if (field in VALUELESS_FIELDS) {
      c.push(tab, {
        rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null, changeType: "setup",
        summary: VALUELESS_FIELDS[field], truncated: true,
      });
    } else if (field in SETUP_FIELDS) {
      c.push({ key: field, label: "Checklist setup" }, {
        rowId: null, rowLabel: null, fieldKey: field, fieldLabel: humanise(field), changeType: "setup", summary: SETUP_FIELDS[field],
      });
    } else if (field === "tabUploadMeta") {
      diffUploadMeta(c, b, a);
    } else if (field === "customTabs") {
      diffCustomTabs(c, b, a);
    } else if (field === "customData") {
      diffCustomData(c, b, a, labelTabs);
    } else {
      standardWalk(c, tab, [], b, a);
    }
    c.closeField(field === "customTabs" || field === "customData" ? { key: field, label: "Custom tabs" } : tab, start);
  }
  return applyBudget(c.events);
}

/** Keeps the stored text for one save under a ceiling; later events lose their values first. */
function applyBudget(events: DraftEvent[]): DraftEvent[] {
  let used = 0;
  return events.map((e) => {
    const size = (typeof e.before === "string" ? e.before.length : e.before === undefined ? 0 : stable(e.before).length) +
      (typeof e.after === "string" ? e.after.length : e.after === undefined ? 0 : stable(e.after).length);
    if (used + size > MAX_CHARS_PER_SAVE) {
      return { ...e, before: undefined, after: undefined, truncated: true };
    }
    used += size;
    return e;
  });
}

/** For saves that send the whole document at once (the older save method): too coarse to itemise honestly. */
export function wholeDocumentEvent(fieldCount: number): DraftEvent {
  return {
    tabKey: "document", tabLabel: "Whole checklist", rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null,
    changeType: "replaced",
    summary: `Saved the whole checklist at once (${fieldCount} sections; changes are not itemised)`,
    truncated: true,
    subject: "document|||replaced",
  };
}

/** A single line for something done by the system or by Claude that is not itemised. */
export function systemEvent(summary: string, changeType: EditChangeType = "system", tab: TabRef = { key: "document", label: "Whole checklist" }): DraftEvent {
  return {
    tabKey: tab.key, tabLabel: tab.label, rowId: null, rowLabel: null, fieldKey: null, fieldLabel: null,
    changeType, summary, truncated: true, subject: `${tab.key}||${summary}|${changeType}`,
  };
}
