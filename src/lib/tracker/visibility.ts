/**
 * The client-safe filter. Every public (unauthenticated) tracker route must
 * pass its data through these functions and nothing else.
 *
 * This is deliberately an ALLOW-list: each output object is built field by
 * field, so a column added to the database later is private until someone adds
 * it here on purpose. (The older checklist routes use a deny-list, which has
 * leaked fields before; do not copy that pattern.)
 */

export interface RawItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  visibility: string;
  isMilestone: boolean;
  phaseId: string | null;
  ownerName: string | null;
  ownerSide: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  waitingOn: string | null;
  archived: boolean;
  // Anything else on the raw object (blockerReason, links, externalDependency,
  // checklistTabSlug, createdVia, ...) is intentionally ignored below.
  [extra: string]: unknown;
}

export interface ClientItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  isMilestone: boolean;
  phaseId: string | null;
  ownerName: string | null;
  ownerSide: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  waitingOn: string | null;
}

export function isClientVisibleItem(item: Pick<RawItem, "visibility" | "archived">): boolean {
  return item.visibility === "client_visible" && !item.archived;
}

export function toClientItem(item: RawItem): ClientItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    priority: item.priority,
    status: item.status,
    isMilestone: item.isMilestone,
    phaseId: item.phaseId,
    ownerName: item.ownerName,
    ownerSide: item.ownerSide,
    startDate: item.startDate,
    dueDate: item.dueDate,
    completedAt: item.completedAt,
    waitingOn: item.waitingOn,
  };
}

export function toClientItems(items: readonly RawItem[]): ClientItem[] {
  return items.filter(isClientVisibleItem).map(toClientItem);
}

export interface RawRemark {
  id: string;
  itemId: string;
  body: string;
  visibility: string;
  /** Internal: a staff email address or "Claude (MCP)". Never shown to clients. */
  authorLabel: string;
  createdVia?: string;
  createdAt: string;
  [extra: string]: unknown;
}

export interface ClientRemark {
  id: string;
  itemId: string;
  body: string;
  /** Always a generic label, never the person's email or login. */
  author: "Talkpush team" | "Client";
  createdAt: string;
}

/** Only shared remarks, and only on items the client can see. */
export function toClientRemarks(
  remarks: readonly RawRemark[],
  visibleItemIds: ReadonlySet<string>
): ClientRemark[] {
  return remarks
    .filter((r) => r.visibility === "shared" && visibleItemIds.has(r.itemId))
    .map((r) => ({
      id: r.id,
      itemId: r.itemId,
      body: r.body,
      author: r.createdVia === "client" ? "Client" : "Talkpush team",
      createdAt: r.createdAt,
    }));
}

export interface RawProject {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  originalTargetDate: string | null;
  goLiveDate: string | null;
  rescheduleCount: number;
  accountName: string;
  [extra: string]: unknown;
}

export interface ClientProject {
  id: string;
  title: string;
  objective: string | null;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  originalTargetDate: string | null;
  goLiveDate: string | null;
  rescheduleCount: number;
  accountName: string;
}

export function toClientProject(p: RawProject): ClientProject {
  return {
    id: p.id,
    title: p.title,
    objective: p.objective,
    status: p.status,
    startDate: p.startDate,
    targetDate: p.targetDate,
    originalTargetDate: p.originalTargetDate,
    goLiveDate: p.goLiveDate,
    rescheduleCount: p.rescheduleCount,
    accountName: p.accountName,
  };
}
