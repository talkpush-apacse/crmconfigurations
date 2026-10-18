/**
 * How a person likes the List tab laid out: row density and which optional columns show. Saved in their own browser
 * only (localStorage); nothing goes to the server. Reading is forgiving, so an old or damaged value just falls back.
 * Pure functions, no React.
 */

export const DENSITIES = ["compact", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

/** Columns that can be switched on or off. The item title is always there. */
export const OPTIONAL_COLUMNS = ["status", "owner", "side", "phase", "due"] as const;
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export const COLUMN_LABELS: Record<OptionalColumn, string> = {
  status: "Status",
  owner: "Owner",
  side: "Owner side",
  phase: "Phase",
  due: "Due",
};

export interface ListPrefs {
  density: Density;
  columns: Record<OptionalColumn, boolean>;
}

/** Phase is off because the phase headers already say it; Owner side is an extra for people who want it. */
export const DEFAULT_PREFS: ListPrefs = {
  density: "compact",
  columns: { status: true, owner: true, side: false, phase: false, due: true },
};

export const PREFS_KEY = "tracker-list-prefs-v1";

export function parsePrefs(raw: string | null | undefined): ListPrefs {
  const out: ListPrefs = { density: DEFAULT_PREFS.density, columns: { ...DEFAULT_PREFS.columns } };
  if (!raw) return out;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return out;
    const v = value as { density?: unknown; columns?: unknown };
    if ((DENSITIES as readonly unknown[]).includes(v.density)) out.density = v.density as Density;
    if (typeof v.columns === "object" && v.columns !== null) {
      for (const c of OPTIONAL_COLUMNS) {
        const on = (v.columns as Record<string, unknown>)[c];
        if (typeof on === "boolean") out.columns[c] = on;
      }
    }
  } catch {
    // Not JSON: keep the defaults.
  }
  return out;
}

export function loadPrefs(): ListPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null); // storage blocked (private window)
  }
}

export function savePrefs(prefs: ListPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked or full: the choice still applies until the page is reloaded.
  }
}
