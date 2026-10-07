/**
 * Modern is the client form face (DESIGN.md): navy, Figtree, 16px type, 2px fields, visible help.
 * Classic is the look the checklist had before it: the shared Talkpush Sign tokens, tooltips for help.
 * The choice is kept in a cookie so the server can render the right look on the first paint.
 * Plain module, so server layouts and client components can both import it.
 */
export type ChecklistLook = "modern" | "classic";

export const LOOK_COOKIE = "cf-look";

export function parseLook(value: string | null | undefined): ChecklistLook {
  return value === "classic" ? "classic" : "modern";
}
