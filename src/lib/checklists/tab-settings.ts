/**
 * Which tabs a checklist shows, who fills each one in, and in what order: the rules behind Claude's
 * `update_checklist_tabs` tool.
 *
 * Pure functions, no database. The tool reads what is saved, calls `planTabSettings`, and saves the result only if
 * something really changes. Turning a tab off only hides it: each tab's answers are stored in their own field and are
 * never touched here, so turning it back on brings everything back.
 */

import { ALWAYS_ENABLED_SLUGS, TAB_CONFIG, excludeTalkpushTabs, getEnabledTabs, getTabBySlug, type FilledBy } from "@/lib/tab-config";
import type { CustomTab } from "@/lib/types";

/** A problem a person can act on. The tool shows the message as it is. */
export class TabSettingsError extends Error {}

export interface TabSettingsState {
  isCustom: boolean;
  enabledTabs: string[] | null;
  tabOrder: string[] | null;
  tabFilledBy: Record<string, FilledBy> | null;
  customTabs: CustomTab[] | null;
}

export interface TabSettingsRequest {
  /** The full list of standard tabs that should be on. Any standard tab not listed is turned off. */
  enabledTabs: string[];
  /** The sidebar order. Tabs not named keep their current order after the named ones. */
  tabOrder?: string[];
  /** Per tab: who fills it in. Tabs not named keep their current setting. */
  filledBy?: Record<string, FilledBy>;
}

export interface TabSettingsPlan {
  /** True when nothing at all would change (the second call with the same input). */
  unchanged: boolean;
  changed: { enabledTabs: boolean; tabOrder: boolean; tabFilledBy: boolean };
  /** The values to store. Only the fields flagged in `changed` need writing. */
  next: { enabledTabs: string[]; tabOrder: string[]; tabFilledBy: Record<string, FilledBy> };
  report: {
    tabsOnBefore: string[];
    tabsOnNow: string[];
    turnedOn: string[];
    turnedOff: string[];
    /** The sidebar order now, standard and custom tabs, only when the order was asked for or changed. */
    order?: string[];
    filledByChanges: Array<{ tab: string; from: FilledBy; to: FilledBy }>;
    /** Custom tabs on the checklist. They are never turned on or off here. */
    customTabs: string[];
    warnings: string[];
  };
}

const STANDARD_SLUGS = TAB_CONFIG.map((t) => t.slug);

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

const clean = (list: readonly string[]) => Array.from(new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean)));

/** Every tab name the sidebar can hold: the standard ones and the custom ones (written custom-<name>). */
function allSlugs(customTabs: CustomTab[] | null): string[] {
  return [...STANDARD_SLUGS, ...(customTabs ?? []).map((t) => `custom-${t.slug}`)];
}

/** The sidebar order of every tab. A stored order may be null or out of date, so it is used to sort the current full set. */
function fullOrder(stored: string[] | null, customTabs: CustomTab[] | null): string[] {
  const all = allSlugs(customTabs);
  if (!stored || stored.length === 0) return all;
  const rank = new Map(stored.map((slug, i) => [slug, i]));
  return all
    .map((slug, i) => ({ slug, rank: rank.get(slug) ?? Infinity, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((e) => e.slug);
}

function currentFilledBy(slug: string, map: Record<string, FilledBy> | null): FilledBy {
  const set = map?.[slug];
  if (set === "client" || set === "talkpush") return set;
  return getTabBySlug(slug)?.filledBy ?? "client";
}

const labelOf = (slug: string, customTabs: CustomTab[] | null) =>
  getTabBySlug(slug)?.label ?? customTabs?.find((t) => `custom-${t.slug}` === slug)?.label ?? slug;

function unknownMessage(unknown: string[], valid: string[], what: string): string {
  const customHint = unknown.some((s) => s.startsWith("custom-"))
    ? " Custom tabs are not turned on or off here (they stay as they are); use delete_custom_tab to remove one."
    : "";
  return (
    `${unknown.map((s) => `"${s}"`).join(", ")} ${unknown.length === 1 ? "is not a tab name" : "are not tab names"}. ` +
    `Nothing was changed. Valid ${what}: ${valid.join(", ")}.${customHint}`
  );
}

export function planTabSettings(state: TabSettingsState, request: TabSettingsRequest): TabSettingsPlan {
  if (state.isCustom) {
    throw new TabSettingsError(
      "This is a custom-form checklist, which has no standard tabs to turn on or off. Nothing was changed."
    );
  }
  const customTabs = state.customTabs ?? [];

  // 1. Which standard tabs are on.
  const wanted = clean(request.enabledTabs);
  const unknownTabs = wanted.filter((s) => !STANDARD_SLUGS.includes(s));
  if (unknownTabs.length > 0) throw new TabSettingsError(unknownMessage(unknownTabs, STANDARD_SLUGS, "standard tab names"));
  const wantedSet = new Set([...ALWAYS_ENABLED_SLUGS, ...wanted]);
  // Kept in the website's own tab order, whatever order Claude listed them in, so the same input always stores the same list.
  const nextEnabled = STANDARD_SLUGS.filter((s) => wantedSet.has(s));

  const beforeSet = new Set(state.enabledTabs ?? STANDARD_SLUGS);
  const tabsOnBefore = STANDARD_SLUGS.filter((s) => beforeSet.has(s));
  const enabledChanged = !sameList(tabsOnBefore, nextEnabled) || (state.enabledTabs !== null && state.enabledTabs.length !== tabsOnBefore.length);

  // 2. The order.
  const everything = allSlugs(state.customTabs);
  const currentOrder = fullOrder(state.tabOrder, state.customTabs);
  let nextOrder = currentOrder;
  if (request.tabOrder) {
    const asked = clean(request.tabOrder);
    const unknownOrder = asked.filter((s) => !everything.includes(s));
    if (unknownOrder.length > 0) throw new TabSettingsError(unknownMessage(unknownOrder, everything, "tab names for the order"));
    nextOrder = [...asked, ...currentOrder.filter((s) => !asked.includes(s))];
  }
  const orderChanged = !sameList(currentOrder, nextOrder);

  // 3. Who fills each tab in.
  const filledByChanges: TabSettingsPlan["report"]["filledByChanges"] = [];
  const nextFilledBy: Record<string, FilledBy> = { ...(state.tabFilledBy ?? {}) };
  if (request.filledBy) {
    const asked = Object.entries(request.filledBy).map(([slug, who]) => [slug.trim().toLowerCase(), who] as const);
    const unknownFilled = asked.map(([s]) => s).filter((s) => !everything.includes(s));
    if (unknownFilled.length > 0) throw new TabSettingsError(unknownMessage(unknownFilled, everything, "tab names for filled_by"));
    for (const [slug, who] of asked) {
      const from = currentFilledBy(slug, state.tabFilledBy);
      if (from === who) continue;
      nextFilledBy[slug] = who;
      filledByChanges.push({ tab: slug, from, to: who });
    }
  }
  const filledByChanged = filledByChanges.length > 0;

  // 4. The checklist must still show something to the people who work in it.
  const editorTabs = getEnabledTabs(nextEnabled, false, nextOrder, state.customTabs, nextFilledBy);
  if (editorTabs.length === 0) {
    throw new TabSettingsError(
      "That would leave the checklist with no tabs at all. Keep at least one standard tab on (or add a custom tab first). Nothing was changed."
    );
  }

  const warnings: string[] = [];
  if (!nextEnabled.includes("welcome") && enabledChanged && beforeSet.has("welcome")) {
    warnings.push("Welcome is now off, so the checklist opens on its first remaining tab instead of the start page.");
  }
  if (excludeTalkpushTabs(editorTabs).length === 0) {
    warnings.push(
      "Every tab that is on is filled in by Talkpush (or is internal), so a client link would show no tabs. Turn on a tab the client fills in, or add a custom tab for them."
    );
  }

  const turnedOn = nextEnabled.filter((s) => !beforeSet.has(s));
  const turnedOff = tabsOnBefore.filter((s) => !wantedSet.has(s));

  return {
    unchanged: !enabledChanged && !orderChanged && !filledByChanged,
    changed: { enabledTabs: enabledChanged, tabOrder: orderChanged, tabFilledBy: filledByChanged },
    next: { enabledTabs: nextEnabled, tabOrder: nextOrder, tabFilledBy: nextFilledBy },
    report: {
      tabsOnBefore,
      tabsOnNow: nextEnabled,
      turnedOn,
      turnedOff,
      ...(request.tabOrder || orderChanged ? { order: nextOrder } : {}),
      filledByChanges,
      customTabs: customTabs.map((t) => `custom-${t.slug}`),
      warnings,
    },
  };
}

/** "Users (users)" for a note a person reads. */
export function describeTabs(slugs: string[], customTabs: CustomTab[] | null = null): string {
  return slugs.map((s) => `${labelOf(s, customTabs)} (${s})`).join(", ");
}
