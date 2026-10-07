export type DigestArea = "tracker" | "workflow" | "checklist";

/** One thing that changed, in a shape that does not depend on which table it came from. */
export interface DigestEntry {
  area: DigestArea;
  /** Entries with the same area and groupId are listed together (one project, one workflow, one checklist). */
  groupId: string;
  groupTitle: string;
  groupSubtitle?: string;
  /** Staff page for the group, for example "/admin/tracker/projects/abc". Joined to the Hub address when emailing. */
  groupPath: string;
  at: Date;
  /** The raw label of who did it (an email, a name, "Claude (MCP)"), or null when nobody is recorded. */
  actor: string | null;
  /** What happened, as a phrase that follows the name: `moved "Set up SSO" from In progress to Done`. */
  text: string;
  /** Entries by the same person with the same key are merged into one line with a count. */
  collapseKey?: string;
}

/** A line under the sections that says honestly what is missing or partial. */
export interface DigestNote {
  tone: "info" | "note";
  text: string;
}

export interface DigestGroup {
  title: string;
  subtitle?: string;
  path: string;
  /** Finished sentences, at most the per-group cap. */
  items: string[];
  /** Sentences that did not fit. */
  more: number;
}

export interface DigestAreaSummary {
  area: DigestArea;
  /** Every change in the area, including ones that are not shown. */
  total: number;
  groups: DigestGroup[];
  /** Groups (projects, workflows, checklists) that did not fit. */
  hiddenGroups: number;
}
