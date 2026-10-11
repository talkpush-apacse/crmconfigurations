import { displayNameFor } from "../edit-history/activity-rules";
import type { DigestEntry } from "./types";

/**
 * Turns checklist history rows (ChecklistEditEvent, written by the edit history on every save) into digest entries.
 * Pure, so the wording and the merging are tested. The history already stores a plain-language summary per change
 * (for example `Added "Pilot site"` or `Changed Email (value not recorded)`) and never keeps passwords, so this never
 * touches the raw before/after values.
 */

export interface ChecklistEventRow {
  actorType: string;
  actorName: string;
  tabKey: string;
  tabLabel: string;
  changeType: string;
  summary: string;
  updatedAt: Date;
  checklist: { id: string; clientName: string };
}

/** Three or more changes by one person in one tab are shown as one line with a count. */
export const MERGE_AT = 3;

/** "Added "x"" becomes `added "x"`, but "AI call" stays as it is. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

const isWholeChecklist = (tabKey: string) => tabKey === "document";

function sentenceFor(row: ChecklistEventRow): string {
  const summary = lowerFirst(row.summary.trim());
  if (isWholeChecklist(row.tabKey) || row.summary.includes(row.tabLabel)) return summary;
  return `${summary} in ${row.tabLabel}`;
}

export function entriesFromChecklistEvents(rows: ChecklistEventRow[]): DigestEntry[] {
  // "checked" lines only say a save looked at a section and nothing changed. They are never changes.
  const changes = rows.filter((r) => r.changeType !== "checked");

  const byPersonAndTab = new Map<string, ChecklistEventRow[]>();
  for (const r of changes) {
    const key = `${r.checklist.id}|${r.actorType}|${r.actorName}|${r.tabKey}`;
    byPersonAndTab.set(key, [...(byPersonAndTab.get(key) ?? []), r]);
  }

  const entries: DigestEntry[] = [];
  for (const group of byPersonAndTab.values()) {
    const first = group[0];
    const base = {
      area: "checklist" as const,
      groupId: first.checklist.id,
      groupTitle: first.checklist.clientName,
      groupPath: `/admin/checklists/${first.checklist.id}`,
      actor: displayNameFor(first.actorType, first.actorName, "staff"),
    };
    if (group.length >= MERGE_AT) {
      const latest = group.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), group[0].updatedAt);
      const where = isWholeChecklist(first.tabKey) ? "" : ` in ${first.tabLabel}`;
      entries.push({ ...base, at: latest, text: `made ${group.length} changes${where}`, count: group.length });
    } else {
      for (const r of group) entries.push({ ...base, at: r.updatedAt, text: sentenceFor(r) });
    }
  }
  return entries;
}
