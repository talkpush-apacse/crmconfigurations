/**
 * Who gets to send this slot's digest? Pure, so the rules are tested without a database.
 *
 * Each 8:00 am slot has one row in ActivityDigestRun (the unique windowEnd). A run first tries to claim the slot:
 *   - nobody has it:                      claim it (the database insert itself decides, so two runs cannot both win)
 *   - it was already sent or skipped:     stop, it is a duplicate (unless a person asked for a re-send with force)
 *   - another run is working on it:       stop, unless that run has been stuck for over 30 minutes (it crashed)
 *   - the last attempt failed:            take it over and try again
 */

export const STALE_AFTER_MS = 30 * 60 * 1000;

export type ClaimDecision = "already_done" | "in_progress" | "takeover";

export interface ExistingRun {
  status: string;
  startedAt: Date;
}

export function decideClaim(existing: ExistingRun, now: Date, force: boolean): ClaimDecision {
  switch (existing.status) {
    case "sent":
    case "skipped":
      return force ? "takeover" : "already_done";
    case "failed":
      return "takeover";
    case "sending":
      // A forced re-send never barges in on a run that is still working.
      return now.getTime() - existing.startedAt.getTime() >= STALE_AFTER_MS ? "takeover" : "in_progress";
    default:
      // A status this code does not know: do nothing rather than risk a second email.
      return "in_progress";
  }
}
