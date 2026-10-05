import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { getClientViewForProject } from "./client-view-service";
import { CLIENT_LIMITS, clientItemCreateSchema, clientItemUpdateSchema, clientRemarkSchema, contributorLinkCreateSchema } from "./contributor-validations";
import { addDays, todayDateOnly, toDateOnly } from "./dates";
import { badRequest, notFound, TrackerError } from "./errors";
import { addRemark, createItem, updateItem } from "./item-service";
import { needsStaffReview } from "./review";
import { generateShareToken, hashShareToken, linkProblem, looksLikeShareToken, tokenMatchesHash } from "./share-token";

/**
 * Contributor links: a private link for ONE client contact that lets them see the
 * client-safe project, add items, and update the items they own. Nothing else.
 *
 * Everything a client can do goes through this file. It never accepts a field that
 * is not in contributor-validations.ts, and it always reuses the staff item rules
 * (dates, status changes, dependency loops) rather than writing its own.
 */

export interface ContributorContext {
  linkId: string;
  projectId: string;
  person: { id: string; name: string };
  /** Who the activity log records: "client:<name>". */
  actor: Actor;
}

const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ staff: create a link

/** Creates a contributor link. The raw token is returned ONCE and can never be recovered afterwards. */
export async function createContributorLink(projectId: string, input: unknown, actor: Actor) {
  const data = contributorLinkCreateSchema.parse(input);
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, accountId: true, archived: true } });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");
  const person = await prisma.trackerPerson.findUnique({ where: { id: data.personId } });
  if (!person || person.archived) throw notFound("Contact");
  if (person.side !== "client" || person.accountId !== project.accountId) {
    throw badRequest("A contributor link needs a client contact from this project's account.");
  }

  const { token, hash, hint } = generateShareToken("contributor");
  const expiresAt = new Date(Date.now() + data.expiresInDays * DAY_MS);

  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.trackerShareLink.create({
      data: {
        projectId,
        kind: "contributor",
        personId: person.id,
        label: data.label ?? person.name,
        tokenHash: hash,
        tokenHint: hint,
        expiresAt,
        createdBy: actor.label,
      },
    });

    let assigned = 0;
    if (data.assignUnassigned) {
      const keys = (
        await tx.trackerPlanTemplateItem.findMany({
          where: { audience: "client", archived: false, template: { archived: false } },
          select: { key: true },
        })
      ).map((k) => k.key);
      if (keys.length > 0) {
        const res = await tx.trackerItem.updateMany({
          where: { projectId, archived: false, ownerPersonId: null, templateItemKey: { in: keys } },
          data: { ownerPersonId: person.id },
        });
        assigned = res.count;
      }
    }

    await logActivity(tx, {
      projectId,
      entityType: "project",
      entityId: projectId,
      action: "share.contributor_created",
      after: { label: link.label, contact: person.name, expiresAt: expiresAt.toISOString(), itemsAssigned: assigned },
      actor,
    });
    return { link, assigned };
  });

  return {
    id: result.link.id,
    kind: "contributor" as const,
    label: result.link.label,
    contact: person.name,
    expiresAt: expiresAt.toISOString(),
    itemsAssigned: result.assigned,
    token,
  };
}

// ------------------------------------------------------------------ public: who is calling

/**
 * Resolve a presented token to a contact and project, or null for ANY problem (malformed, unknown,
 * wrong kind, revoked, expired, archived project, archived or wrong contact). The caller answers null
 * with the same generic 404 so a bad link reveals nothing.
 */
export async function resolveContributorToken(token: string): Promise<ContributorContext | null> {
  if (!looksLikeShareToken(token, "contributor")) return null;
  const link = await prisma.trackerShareLink.findUnique({ where: { tokenHash: hashShareToken(token) } });
  if (!link || !tokenMatchesHash(token, link.tokenHash)) return null;
  if (linkProblem(link, "contributor") !== null || !link.personId) return null;
  const [project, person] = await Promise.all([
    prisma.trackerProject.findUnique({ where: { id: link.projectId }, select: { archived: true, accountId: true } }),
    prisma.trackerPerson.findUnique({ where: { id: link.personId }, select: { id: true, name: true, side: true, archived: true, accountId: true } }),
  ]);
  if (!project || project.archived) return null;
  if (!person || person.archived || person.side !== "client" || person.accountId !== project.accountId) return null;
  if (!link.lastUsedAt || Date.now() - link.lastUsedAt.getTime() > 60_000) {
    void prisma.trackerShareLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return {
    linkId: link.id,
    projectId: link.projectId,
    person: { id: person.id, name: person.name },
    actor: { label: `client:${person.name}`, via: "client" },
  };
}

// ------------------------------------------------------------------ public: what they see

/** The client-safe project plus the item list this contact can act on. Explicit selects only. */
export async function getContributorView(ctx: ContributorContext) {
  const view = await getClientViewForProject(ctx.projectId);
  const rows = await prisma.trackerItem.findMany({
    where: { projectId: ctx.projectId, archived: false, visibility: "client_visible" },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      isMilestone: true,
      ownerPersonId: true,
      createdVia: true,
      staffReviewedAt: true,
      owner: { select: { name: true, side: true } },
      phase: { select: { name: true } },
      blockedBy: { select: { blockedByItemId: true } },
    },
  });
  const visible = new Set(rows.map((r) => r.id));
  const items = rows.map((r) => {
    const mine = r.ownerPersonId === ctx.person.id;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      dueDate: toDateOnly(r.dueDate),
      isMilestone: r.isMilestone,
      phaseName: r.phase?.name ?? null,
      ownerName: r.owner?.name ?? null,
      ownerSide: r.owner?.side ?? null,
      mine,
      /** This contact may change the status (own item that is not blocked or dropped). */
      canUpdate: mine && r.status !== "blocked" && r.status !== "dropped",
      addedByClient: r.createdVia === "client",
      awaitingReview: needsStaffReview(r),
      // Only links to other client-visible items; anything else is never revealed.
      waitsOn: r.blockedBy.map((b) => b.blockedByItemId).filter((id) => visible.has(id)),
    };
  });
  return { view, you: { name: ctx.person.name }, items, limits: { maxWaitsOn: CLIENT_LIMITS.maxWaitsOn } };
}

// ------------------------------------------------------------------ public: what they can do

async function assertWithinLimits(ctx: ContributorContext, kind: "item" | "change") {
  const since = new Date(Date.now() - DAY_MS);
  if (kind === "item") {
    const made = await prisma.trackerItem.count({
      where: { projectId: ctx.projectId, createdVia: "client", ownerPersonId: ctx.person.id, createdAt: { gte: since } },
    });
    if (made >= CLIENT_LIMITS.newItemsPerDay) {
      throw new TrackerError("You have added a lot of items today. Please try again tomorrow, or ask your Talkpush contact.", 429);
    }
  }
  const changes = await prisma.trackerActivity.count({
    where: { projectId: ctx.projectId, via: "client", actorLabel: ctx.actor.label, createdAt: { gte: since } },
  });
  if (changes >= CLIENT_LIMITS.changesPerDay) {
    throw new TrackerError("You have made a lot of changes today. Please try again tomorrow, or ask your Talkpush contact.", 429);
  }
}

export async function addClientItem(ctx: ContributorContext, input: unknown) {
  const data = clientItemCreateSchema.parse(input);
  await assertWithinLimits(ctx, "item");

  const today = todayDateOnly();
  if (data.dueDate && data.dueDate > addDays(today, CLIENT_LIMITS.maxDueDaysAhead)) {
    throw badRequest("Please choose a target date within the next two years.");
  }
  // It may only wait for items the client can already see in this project.
  const waitsOn = Array.from(new Set(data.waitsOn));
  if (waitsOn.length > 0) {
    const found = await prisma.trackerItem.count({
      where: { id: { in: waitsOn }, projectId: ctx.projectId, archived: false, visibility: "client_visible" },
    });
    if (found !== waitsOn.length) throw badRequest("Some of the items you chose to wait for are not available.");
  }

  const created = await createItem(
    ctx.projectId,
    {
      title: data.title,
      description: data.description,
      priority: data.priority,
      dueDate: data.dueDate,
      visibility: "client_visible",
      ownerPersonId: ctx.person.id,
      blockedByItemIds: waitsOn,
    },
    ctx.actor
  );
  return { id: created.id, title: created.title, status: created.status, awaitingReview: true };
}

async function loadOwnedItem(ctx: ContributorContext, itemId: string) {
  const item = await prisma.trackerItem.findFirst({
    where: { id: itemId, projectId: ctx.projectId, archived: false, visibility: "client_visible" },
    select: { id: true, status: true, ownerPersonId: true },
  });
  if (!item) throw notFound("Item");
  if (item.ownerPersonId !== ctx.person.id) throw new TrackerError("You can only update items that are assigned to you.", 403);
  return item;
}

export async function updateClientItemStatus(ctx: ContributorContext, itemId: string, input: unknown) {
  const data = clientItemUpdateSchema.parse(input);
  const item = await loadOwnedItem(ctx, itemId);
  if (item.status === "blocked" || item.status === "dropped") {
    throw badRequest("This item is on hold with Talkpush. Please ask your Talkpush contact to update it.");
  }
  await assertWithinLimits(ctx, "change");
  const updated = await updateItem(itemId, { status: data.status }, ctx.actor);
  return { id: updated.id, status: updated.status };
}

export async function addClientRemark(ctx: ContributorContext, itemId: string, input: unknown) {
  const data = clientRemarkSchema.parse(input);
  await loadOwnedItem(ctx, itemId);
  await assertWithinLimits(ctx, "change");
  const remark = await addRemark(itemId, { body: data.body, visibility: "shared" }, ctx.actor);
  return { id: remark.id };
}
