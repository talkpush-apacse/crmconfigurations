import type {
  TrackerAccount,
  TrackerItem,
  TrackerPerson,
  TrackerPhase,
  TrackerRemark,
} from "@/generated/prisma/client";
import { toDateOnly } from "./dates";
import { needsStaffReview } from "./review";

export function serializeAccount(a: TrackerAccount & { company?: { name: string } | null }) {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    notes: a.notes,
    archived: a.archived,
    /** The company this account is for and its geo, empty on accounts made before companies existed. */
    companyId: a.companyId,
    companyName: a.company?.name ?? null,
    geo: a.geo,
    geoCode: a.geoCode,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializePerson(p: TrackerPerson & { account?: { name: string } | null }) {
  return {
    id: p.id,
    accountId: p.accountId,
    accountName: p.account?.name ?? null,
    side: p.side,
    name: p.name,
    email: p.email,
    title: p.title,
    organisation: p.organisation,
    adminUserId: p.adminUserId,
    archived: p.archived,
  };
}

export function serializePhase(p: TrackerPhase) {
  return {
    id: p.id,
    projectId: p.projectId,
    name: p.name,
    sortOrder: p.sortOrder,
    startDate: toDateOnly(p.startDate),
    endDate: toDateOnly(p.endDate),
    exitCriteria: p.exitCriteria,
  };
}

export type ItemWithRelations = TrackerItem & {
  owner: Pick<TrackerPerson, "id" | "name" | "side"> | null;
  phase: Pick<TrackerPhase, "id" | "name"> | null;
  blockedBy: { blockedByItemId: string }[];
  _count?: { remarks: number };
};

export function serializeItem(i: ItemWithRelations) {
  return {
    id: i.id,
    projectId: i.projectId,
    phaseId: i.phaseId,
    phaseName: i.phase?.name ?? null,
    title: i.title,
    description: i.description,
    type: i.type,
    priority: i.priority,
    status: i.status,
    visibility: i.visibility,
    isMilestone: i.isMilestone,
    ownerPersonId: i.ownerPersonId,
    ownerName: i.owner?.name ?? null,
    ownerSide: i.owner?.side ?? null,
    startDate: toDateOnly(i.startDate),
    dueDate: toDateOnly(i.dueDate),
    completedAt: i.completedAt ? i.completedAt.toISOString() : null,
    blockerReason: i.blockerReason,
    waitingOn: i.waitingOn,
    externalDependency: i.externalDependency,
    links: Array.isArray(i.links) ? i.links : [],
    checklistTabSlug: i.checklistTabSlug,
    sortOrder: i.sortOrder,
    archived: i.archived,
    createdVia: i.createdVia,
    staffReviewedAt: i.staffReviewedAt ? i.staffReviewedAt.toISOString() : null,
    needsReview: needsStaffReview(i),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    blockedByItemIds: i.blockedBy.map((d) => d.blockedByItemId),
    remarkCount: i._count?.remarks ?? 0,
  };
}

export function serializeRemark(r: TrackerRemark) {
  return {
    id: r.id,
    itemId: r.itemId,
    body: r.body,
    visibility: r.visibility,
    authorLabel: r.authorLabel,
    createdVia: r.createdVia,
    createdAt: r.createdAt.toISOString(),
  };
}
