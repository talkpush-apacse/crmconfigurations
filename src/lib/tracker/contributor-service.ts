import { prisma } from "@/lib/db";
import type { Actor } from "./actor";
import { logActivity } from "./activity";
import { getClientViewForProject } from "./client-view-service";
import { CLIENT_LIMITS, clientItemCreateSchema, clientItemEditSchema, clientRemarkSchema, contributorLinkCreateSchema } from "./contributor-validations";
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
  return issueContributorLink(
    projectId,
    {
      personId: data.personId,
      label: data.label ?? null,
      expiresAt: new Date(Date.now() + data.expiresInDays * DAY_MS),
      assignUnassigned: data.assignUnassigned,
    },
    actor
  );
}

export interface ContributorLinkRequest {
  personId: string;
  label: string | null;
  expiresAt: Date;
  assignUnassigned: boolean;
  /** Turn off this contact's earlier live link with the SAME label first (used by the Claude connector, which labels its own links). */
  replaceSameLabel?: boolean;
}

/** The one place a contributor link is made. Callers validate the expiry; this checks the contact and project. */
export async function issueContributorLink(projectId: string, data: ContributorLinkRequest, actor: Actor) {
  const project = await prisma.trackerProject.findUnique({ where: { id: projectId }, select: { id: true, accountId: true, archived: true } });
  if (!project) throw notFound("Project");
  if (project.archived) throw badRequest("This project is archived.");
  const person = await prisma.trackerPerson.findUnique({ where: { id: data.personId } });
  if (!person || person.archived) throw notFound("Contact");
  if (person.side !== "client" || person.accountId !== project.accountId) {
    throw badRequest("A contributor link needs a client contact from this project's account.");
  }

  const { token, hash, hint } = generateShareToken("contributor");
  const expiresAt = data.expiresAt;
  const label = data.label ?? person.name;

  const result = await prisma.$transaction(async (tx) => {
    let replaced = 0;
    if (data.replaceSameLabel) {
      const old = await tx.trackerShareLink.findMany({ where: { projectId, kind: "contributor", personId: person.id, label, revokedAt: null } });
      if (old.length > 0) {
        await tx.trackerShareLink.updateMany({ where: { id: { in: old.map((l) => l.id) } }, data: { revokedAt: new Date() } });
        await logActivity(tx, {
          projectId,
          entityType: "project",
          entityId: projectId,
          action: "share.revoked",
          after: { label, replacedBy: "a new link", count: old.length },
          actor,
        });
        replaced = old.length;
      }
    }
    const link = await tx.trackerShareLink.create({
      data: {
        projectId,
        kind: "contributor",
        personId: person.id,
        label,
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
    return { link, assigned, replaced };
  });

  return {
    id: result.link.id,
    kind: "contributor" as const,
    label: result.link.label,
    contact: person.name,
    expiresAt: expiresAt.toISOString(),
    itemsAssigned: result.assigned,
    replaced: result.replaced,
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
      startDate: true,
      updatedAt: true,
      createdVia: true,
      staffReviewedAt: true,
      owner: { select: { name: true, side: true } },
      phase: { select: { name: true } },
      blockedBy: { select: { blockedByItemId: true } },
    },
  });
  const visible = new Set(rows.map((r) => r.id));
  const [peopleRows, remarkRows] = await Promise.all([
    prisma.trackerPerson.findMany({ where: { side: "client", archived: false, account: { projects: { some: { id: ctx.projectId } } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.trackerRemark.findMany({
      where: { itemId: { in: Array.from(visible) }, visibility: "shared" },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, itemId: true, body: true, authorLabel: true, createdVia: true, createdAt: true },
    }),
  ]);
  // Comments: a client contact is shown by name, Talkpush staff only ever as "Talkpush team" (never an email).
  const comments = remarkRows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    body: r.body,
    author: r.createdVia === "client" ? r.authorLabel.replace(/^client:/i, "").trim() || "A client contact" : "Talkpush team",
    side: r.createdVia === "client" ? ("client" as const) : ("talkpush" as const),
    createdAt: r.createdAt.toISOString(),
  }));
  const items = rows.map((r) => {
    const mine = r.ownerPersonId === ctx.person.id;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      startDate: toDateOnly(r.startDate),
      dueDate: toDateOnly(r.dueDate),
      isMilestone: r.isMilestone,
      phaseName: r.phase?.name ?? null,
      ownerName: r.owner?.name ?? null,
      ownerSide: r.owner?.side ?? null,
      ownerPersonId: r.ownerPersonId,
      updatedAt: r.updatedAt.toISOString(),
      mine,
      /** Every visible item can be edited. Status stays with Talkpush while an item is blocked or dropped. */
      canUpdate: r.status !== "blocked" && r.status !== "dropped",
      /** The owner can only be changed on items a client or nobody owns. */
      canChangeOwner: r.owner === null || r.owner.side === "client",
      addedByClient: r.createdVia === "client",
      awaitingReview: needsStaffReview(r),
      // Only links to other client-visible items; anything else is never revealed.
      waitsOn: r.blockedBy.map((b) => b.blockedByItemId).filter((id) => visible.has(id)),
    };
  });
  return { view, you: { id: ctx.person.id, name: ctx.person.name }, items, people: peopleRows, comments, limits: { maxWaitsOn: CLIENT_LIMITS.maxWaitsOn } };
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
    where: { projectId: ctx.projectId, via: "client", actorLabel: ctx.actor.label, action: { not: "export.downloaded" }, createdAt: { gte: since } },
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

/** An item this client can see right now (live and client-visible) in their own project. Anything else looks like it does not exist. */
async function loadVisibleItem(ctx: ContributorContext, itemId: string) {
  const item = await prisma.trackerItem.findFirst({
    where: { id: itemId, projectId: ctx.projectId, archived: false, visibility: "client_visible" },
    select: { id: true, status: true, ownerPersonId: true, updatedAt: true, owner: { select: { side: true } }, blockedBy: { select: { blockedByItemId: true } } },
  });
  if (!item) throw notFound("Item");
  return item;
}

/**
 * A client contact edits ANY item they can see: title, details, status, priority, dates, owner (only among client
 * contacts) and what it waits for. Everything else stays with Talkpush. It goes through the same updateItem every
 * staff edit uses, so the date, status and dependency-loop rules are identical, and it is written to the activity log
 * under the contact's name.
 */
export async function editClientItem(ctx: ContributorContext, itemId: string, input: unknown) {
  const data = clientItemEditSchema.parse(input);
  const item = await loadVisibleItem(ctx, itemId);

  if (data.expectedUpdatedAt && new Date(data.expectedUpdatedAt).getTime() !== item.updatedAt.getTime()) {
    throw new TrackerError("Someone changed this item while you were looking at it. Your screen has been refreshed. Please check it, then make your change again.", 409);
  }

  // Blocked and dropped are Talkpush's to set and to clear.
  if (data.status !== undefined && data.status !== item.status && (item.status === "blocked" || item.status === "dropped")) {
    throw badRequest("This item is on hold with Talkpush. Please ask your Talkpush contact to update its status.");
  }

  // The owner can move between client contacts, but a Talkpush or vendor item stays where it is.
  if (data.ownerPersonId !== undefined && data.ownerPersonId !== item.ownerPersonId) {
    if (item.owner && item.owner.side !== "client") {
      throw new TrackerError("This item is looked after by Talkpush. Please ask your Talkpush contact to reassign it.", 403);
    }
    if (data.ownerPersonId !== null) {
      const person = await prisma.trackerPerson.findFirst({
        where: { id: data.ownerPersonId, side: "client", archived: false, account: { projects: { some: { id: ctx.projectId } } } },
        select: { id: true },
      });
      if (!person) throw badRequest("That person is not on your team for this project.");
    }
  }

  const today = todayDateOnly();
  for (const date of [data.startDate, data.dueDate]) {
    if (date && date > addDays(today, CLIENT_LIMITS.maxDueDaysAhead)) throw badRequest("Please choose a date within the next two years.");
  }

  // "Waits for": the client sees and replaces only the items it can see. A dependency on a team-only item is kept as it is.
  let blockedByItemIds: string[] | undefined;
  if (data.waitsOn !== undefined) {
    const chosen = Array.from(new Set(data.waitsOn)).filter((id) => id !== itemId);
    if (chosen.length > 0) {
      const found = await prisma.trackerItem.count({ where: { id: { in: chosen }, projectId: ctx.projectId, archived: false, visibility: "client_visible" } });
      if (found !== chosen.length) throw badRequest("Some of the items you chose to wait for are not available.");
    }
    const existing = item.blockedBy.map((b) => b.blockedByItemId);
    const hidden = existing.length
      ? (await prisma.trackerItem.findMany({ where: { id: { in: existing }, NOT: { visibility: "client_visible", archived: false } }, select: { id: true } })).map((i) => i.id)
      : [];
    blockedByItemIds = [...chosen, ...hidden];
  }

  await assertWithinLimits(ctx, "change");

  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.startDate !== undefined) patch.startDate = data.startDate;
  if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
  if (data.ownerPersonId !== undefined) patch.ownerPersonId = data.ownerPersonId;
  if (blockedByItemIds !== undefined) patch.blockedByItemIds = blockedByItemIds;

  const updated = await updateItem(itemId, patch, ctx.actor);
  return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt };
}

/** The previous name of the status-only edit; it now goes through the full edit rules. */
export const updateClientItemStatus = editClientItem;

/** A client contact comments on ANY item they can see. The comment is shared (Talkpush sees it, and so does every client link). */
export async function addClientRemark(ctx: ContributorContext, itemId: string, input: unknown) {
  const data = clientRemarkSchema.parse(input);
  await loadVisibleItem(ctx, itemId);
  await assertWithinLimits(ctx, "change");
  const remark = await addRemark(itemId, { body: data.body, visibility: "shared" }, ctx.actor);
  return { id: remark.id };
}
