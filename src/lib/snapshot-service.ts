import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  CHECKLIST_JSON_FIELDS,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotMetadata,
  type SnapshotPayload,
  type SnapshotSummary,
} from "@/lib/types";

export class SnapshotServiceError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const MAX_SNAPSHOTS_PER_CHECKLIST = 20;

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function getSnapshotSummary(payload: SnapshotPayload | null | undefined): SnapshotSummary {
  const p = (payload ?? {}) as Record<string, unknown>;
  return {
    usersCount: arrayCount(p.users),
    campaignsCount: arrayCount(p.campaigns),
    sitesCount: arrayCount(p.sites),
    foldersCount: arrayCount(p.folders),
    sourcesCount: arrayCount(p.sources),
    prescreeningCount: arrayCount(p.prescreening),
    messagingCount: arrayCount(p.messaging),
    documentsCount: arrayCount(p.documents),
    attributesCount: arrayCount(p.attributes),
    agencyPortalCount: arrayCount(p.agencyPortal),
    agencyPortalUsersCount: arrayCount(p.agencyPortalUsers),
    labelsCount: arrayCount(p.labels),
    rejectionReasonsCount: arrayCount(p.rejectionReasons),
    atsIntegrationsCount: arrayCount(p.atsIntegrations),
    integrationsCount: arrayCount(p.integrations),
    autoflowsCount: arrayCount(p.autoflows),
    customTabsCount: arrayCount(p.customTabs),
  };
}

function buildPayload(checklist: Record<string, unknown>): SnapshotPayload {
  const payload: Record<string, unknown> = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    isCustom: !!checklist.isCustom,
    configuratorChecklist: checklist.configuratorChecklist ?? null,
  };
  for (const field of CHECKLIST_JSON_FIELDS) {
    payload[field] = checklist[field] ?? null;
  }
  return payload as SnapshotPayload;
}

function toSnapshotMetadata(row: {
  id: string;
  label: string | null;
  description: string | null;
  isLabeled: boolean;
  versionAtSnapshot: number;
  createdAt: Date;
  createdBy: string;
  createdByLabel: string | null;
  archived: boolean;
  archivedAt: Date | null;
  payload: unknown;
}): SnapshotMetadata {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    isLabeled: row.isLabeled,
    versionAtSnapshot: row.versionAtSnapshot,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    createdByLabel: row.createdByLabel,
    archived: row.archived,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    summary: getSnapshotSummary(row.payload as SnapshotPayload | null),
  };
}

export async function createSnapshot(
  checklistId: string,
  opts: {
    label?: string | null;
    description?: string | null;
    createdBy: "admin" | "mcp";
    createdByLabel?: string | null;
  }
): Promise<SnapshotMetadata> {
  const trimmedLabel = opts.label?.trim() || null;
  const trimmedDescription = opts.description?.trim() || null;

  const inserted = await prisma.$transaction(async (tx) => {
    // Lock the parent checklist row to prevent capturing a half-saved state
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Checklist" WHERE id = ${checklistId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new SnapshotServiceError("Checklist not found", 404);
    }

    const checklist = await tx.checklist.findUnique({ where: { id: checklistId } });
    if (!checklist) {
      throw new SnapshotServiceError("Checklist not found", 404);
    }

    const payload = buildPayload(checklist as unknown as Record<string, unknown>);

    const snapshot = await tx.checklistSnapshot.create({
      data: {
        checklistId,
        label: trimmedLabel,
        description: trimmedDescription,
        isLabeled: !!trimmedLabel,
        payload: toPrismaJson(payload),
        versionAtSnapshot: checklist.version,
        createdBy: opts.createdBy,
        createdByLabel: opts.createdByLabel ?? null,
      },
    });

    // Enforce 20-snapshot cap on non-archived rows.
    // Auto-archive only the oldest UNLABELED snapshots.
    const activeCount = await tx.checklistSnapshot.count({
      where: { checklistId, archived: false },
    });

    if (activeCount > MAX_SNAPSHOTS_PER_CHECKLIST) {
      const overflow = activeCount - MAX_SNAPSHOTS_PER_CHECKLIST;
      const candidates = await tx.checklistSnapshot.findMany({
        where: { checklistId, archived: false, isLabeled: false },
        orderBy: { createdAt: "asc" },
        take: overflow,
        select: { id: true },
      });
      if (candidates.length > 0) {
        await tx.checklistSnapshot.updateMany({
          where: { id: { in: candidates.map((c) => c.id) } },
          data: { archived: true, archivedAt: new Date() },
        });
      }
    }

    return snapshot;
  });

  return toSnapshotMetadata(inserted);
}

export async function listSnapshots(
  checklistId: string,
  opts?: { includeArchived?: boolean }
): Promise<SnapshotMetadata[]> {
  const where: Prisma.ChecklistSnapshotWhereInput = { checklistId };
  if (!opts?.includeArchived) where.archived = false;

  const rows = await prisma.checklistSnapshot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      description: true,
      isLabeled: true,
      versionAtSnapshot: true,
      createdAt: true,
      createdBy: true,
      createdByLabel: true,
      archived: true,
      archivedAt: true,
      payload: true,
    },
  });

  return rows.map(toSnapshotMetadata);
}

export async function getSnapshot(snapshotId: string): Promise<{
  metadata: SnapshotMetadata;
  payload: SnapshotPayload;
  checklistId: string;
}> {
  const row = await prisma.checklistSnapshot.findUnique({ where: { id: snapshotId } });
  if (!row) throw new SnapshotServiceError("Snapshot not found", 404);

  return {
    metadata: toSnapshotMetadata(row),
    payload: row.payload as SnapshotPayload,
    checklistId: row.checklistId,
  };
}

export async function updateSnapshot(
  snapshotId: string,
  patch: {
    label?: string | null;
    description?: string | null;
    archived?: boolean;
  }
): Promise<SnapshotMetadata> {
  const existing = await prisma.checklistSnapshot.findUnique({ where: { id: snapshotId } });
  if (!existing) throw new SnapshotServiceError("Snapshot not found", 404);

  const data: Prisma.ChecklistSnapshotUpdateInput = {};
  if (patch.label !== undefined) {
    const trimmed = patch.label?.trim() || null;
    data.label = trimmed;
    data.isLabeled = !!trimmed;
  }
  if (patch.description !== undefined) {
    data.description = patch.description?.trim() || null;
  }
  if (patch.archived !== undefined) {
    data.archived = patch.archived;
    data.archivedAt = patch.archived ? new Date() : null;
  }

  const updated = await prisma.checklistSnapshot.update({
    where: { id: snapshotId },
    data,
  });
  return toSnapshotMetadata(updated);
}

export async function softDeleteSnapshot(snapshotId: string): Promise<void> {
  const existing = await prisma.checklistSnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true },
  });
  if (!existing) throw new SnapshotServiceError("Snapshot not found", 404);

  await prisma.checklistSnapshot.update({
    where: { id: snapshotId },
    data: { archived: true, archivedAt: new Date() },
  });
}

export async function hardDeleteSnapshot(snapshotId: string): Promise<void> {
  const existing = await prisma.checklistSnapshot.findUnique({
    where: { id: snapshotId },
    select: { id: true },
  });
  if (!existing) throw new SnapshotServiceError("Snapshot not found", 404);

  await prisma.checklistSnapshot.delete({ where: { id: snapshotId } });
}

export async function restoreSnapshot(
  snapshotId: string,
  opts: { createdBy: "admin" | "mcp"; createdByLabel?: string | null }
): Promise<{
  preRestoreSnapshotId: string;
  newVersion: number;
  checklistId: string;
}> {
  const result = await prisma.$transaction(async (tx) => {
    const snapshotRow = await tx.checklistSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshotRow) {
      throw new SnapshotServiceError("Snapshot not found", 404);
    }

    // Lock the parent checklist row
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Checklist" WHERE id = ${snapshotRow.checklistId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new SnapshotServiceError("Parent checklist not found", 404);
    }

    const current = await tx.checklist.findUnique({ where: { id: snapshotRow.checklistId } });
    if (!current) {
      throw new SnapshotServiceError("Parent checklist not found", 404);
    }

    // 1. Auto-create pre-restore snapshot of CURRENT state (sticky / labeled)
    const preRestoreLabel = `Auto: pre-restore @ ${new Date().toISOString()}`;
    const preRestorePayload = buildPayload(current as unknown as Record<string, unknown>);
    const preRestore = await tx.checklistSnapshot.create({
      data: {
        checklistId: current.id,
        label: preRestoreLabel,
        description: `Auto-created before restoring snapshot ${snapshotId}`,
        isLabeled: true,
        payload: toPrismaJson(preRestorePayload),
        versionAtSnapshot: current.version,
        createdBy: opts.createdBy,
        createdByLabel: opts.createdByLabel ?? null,
      },
    });

    // 2. Deep-merge snapshot payload over current schema defaults (forward-compat)
    const snapshotPayload = (snapshotRow.payload ?? {}) as Record<string, unknown>;
    const newVersion = current.version + 1;

    const updateData: Record<string, unknown> = {
      version: newVersion,
      // Reset all field-level versions to the new version so any in-flight
      // client PATCH carrying an older fieldVersion will be flagged 409.
      fieldVersions: toPrismaJson(
        Object.fromEntries(CHECKLIST_JSON_FIELDS.map((f) => [f, newVersion]))
      ),
      configuratorChecklist:
        snapshotPayload.configuratorChecklist === undefined
          ? current.configuratorChecklist ?? null
          : toPrismaJson(snapshotPayload.configuratorChecklist),
      isCustom:
        typeof snapshotPayload.isCustom === "boolean"
          ? snapshotPayload.isCustom
          : current.isCustom,
    };

    for (const field of CHECKLIST_JSON_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(snapshotPayload, field)) {
        const value = snapshotPayload[field];
        // `integrations` is non-nullable on schema (default '[]') — coerce null → []
        if (field === "integrations" && (value === null || value === undefined)) {
          updateData[field] = toPrismaJson([]);
        } else {
          updateData[field] = value === undefined ? null : toPrismaJson(value);
        }
      }
      // If the snapshot doesn't have this field at all (older schema), leave
      // current value as-is — that's the forward-compat guarantee.
    }

    await tx.checklist.update({
      where: { id: current.id },
      data: updateData as Prisma.ChecklistUpdateInput,
    });

    return {
      preRestoreSnapshotId: preRestore.id,
      newVersion,
      checklistId: current.id,
    };
  });

  return result;
}

export async function getChecklistIdBySlug(slug: string): Promise<string> {
  const row = await prisma.checklist.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) throw new SnapshotServiceError(`Checklist with slug "${slug}" not found`, 404);
  return row.id;
}
