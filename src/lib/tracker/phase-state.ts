export type PhaseState = "no_items" | "complete" | "in_progress" | "upcoming";

/**
 * Where a phase stands, from its items. Several phases can be in progress at once.
 * In progress = some item has started (in progress, waiting on the client, blocked) or the phase is partly done.
 */
export function phaseState(p: { total: number; done: number; open: number; started: number }): PhaseState {
  if (p.total === 0) return "no_items";
  if (p.open === 0) return "complete";
  if (p.started > 0 || p.done > 0) return "in_progress";
  return "upcoming";
}

export const PHASE_STATE_LABELS: Record<PhaseState, string> = {
  no_items: "No items",
  complete: "Complete",
  in_progress: "In progress",
  upcoming: "Upcoming",
};

/** "Scoping", "Scoping and Configuration", "Scoping, Configuration and UAT". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
