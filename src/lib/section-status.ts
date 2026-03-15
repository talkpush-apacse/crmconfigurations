/**
 * Computes the completion state of a single checklist section's data value.
 * Used in the client layout (nav dots) and WelcomeSheet (progress chips).
 * Single source of truth — do not duplicate this logic elsewhere.
 */
export function getSectionState(
  val: unknown
): "complete" | "in-progress" | "not-started" {
  if (val === null || val === undefined) return "not-started";

  if (Array.isArray(val)) {
    if (val.length === 0) return "not-started";
    const nonEmpty = val.filter((item) =>
      typeof item === "object" && item !== null
        ? Object.values(item as Record<string, unknown>).some(
            (v) => v !== "" && v !== null && v !== undefined
          )
        : true
    );
    return nonEmpty.length >= 3 ? "complete" : "in-progress";
  }

  if (typeof val === "object") {
    const values = Object.values(val as Record<string, unknown>);
    const filled = values.filter(
      (v) => v !== "" && v !== null && v !== undefined
    ).length;
    if (filled === 0) return "not-started";
    return filled / values.length >= 0.6 ? "complete" : "in-progress";
  }

  return "in-progress";
}
