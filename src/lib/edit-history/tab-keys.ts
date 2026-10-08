import { getTabBySlug } from "@/lib/tab-config";

/**
 * Which saved sections and which history lines belong to the tab shown at an address like `/editor/<link>/users`.
 * No server imports, so the browser can use it to decide whether a page is a checklist tab at all.
 *
 *  - A standard tab is one saved section (its data key), for example `users`.
 *  - Every custom tab (`custom-<name>`) is stored inside the SAME two sections (`customTabs` and `customData`), so a
 *    change to any custom tab can make a save of another custom tab be refused. History lines are kept per custom tab.
 */
export interface ActivityTab {
  /** The tab's name in the edit history. */
  tabKey: string;
  /** The saved sections whose version number tells whether the tab changed. */
  fields: string[];
}

export function activityTabForSlug(slug: string): ActivityTab | null {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(slug)) return null;
  if (slug.startsWith("custom-")) return { tabKey: slug, fields: ["customTabs", "customData"] };
  const tab = getTabBySlug(slug);
  if (!tab || !tab.dataKey) return null;
  return { tabKey: tab.dataKey, fields: [tab.dataKey] };
}
