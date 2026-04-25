import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CONFIGURATOR_TEMPLATE, type ConfiguratorChecklistBlob, type ConfiguratorItemState, type ConfiguratorStatus } from "@/lib/configurator-template";
import { getApplicableItems } from "@/lib/configurator-filter";
import { syncConfiguratorState } from "@/lib/configurator-sync";
import { defaultCommunicationChannels, defaultFeatureToggles } from "@/lib/template-data";
import { getAllSelectableTabSlugs, TAB_CONFIG } from "@/lib/tab-config";
import type { CommunicationChannels, FeatureToggles } from "@/lib/types";

export class ConfiguratorServiceError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

type ChecklistConfigRow = {
  id: string;
  slug: string;
  clientName: string;
  version: number;
  configuratorChecklist: unknown | null;
  enabledTabs: unknown | null;
  communicationChannels: unknown | null;
  featureToggles: unknown | null;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asConfiguratorBlob(value: unknown | null): ConfiguratorChecklistBlob | null {
  if (!value || typeof value !== "object") return null;
  const blob = value as Partial<ConfiguratorChecklistBlob>;
  if (!Array.isArray(blob.items) || !Array.isArray(blob.snapshotItemIds)) return null;
  if (typeof blob.generatedAt !== "string" || typeof blob.lastSnapshotAt !== "string") return null;
  return blob as ConfiguratorChecklistBlob;
}

function normalizeEnabledTabs(value: unknown | null): string[] {
  const selectedSlugs = Array.isArray(value)
    ? value.filter((tab): tab is string => typeof tab === "string")
    : getAllSelectableTabSlugs();

  const enabled = new Set(selectedSlugs);
  for (const tab of TAB_CONFIG) {
    if (selectedSlugs.includes(tab.slug) && tab.dataKey) {
      enabled.add(tab.dataKey);
    }
  }

  return Array.from(enabled);
}

function normalizeChannels(value: unknown | null, enabledTabs: string[]): string[] {
  const channels = new Set<string>();

  if (Array.isArray(value)) {
    for (const channel of value) {
      if (typeof channel === "string") channels.add(channel);
    }
  } else {
    const source =
      value && typeof value === "object"
        ? (value as Partial<CommunicationChannels>)
        : defaultCommunicationChannels;

    for (const [key, enabled] of Object.entries(source)) {
      if (enabled) channels.add(key);
    }
  }

  if (channels.has("messenger")) channels.add("facebook");
  if (enabledTabs.includes("instagram")) channels.add("instagram");
  if (enabledTabs.includes("fbWhatsapp") || enabledTabs.includes("facebook-whatsapp")) {
    channels.add("facebook");
  }

  return Array.from(channels);
}

function normalizeFeatureToggles(value: unknown | null): Record<string, boolean> {
  const source =
    value && typeof value === "object"
      ? (value as Partial<FeatureToggles>)
      : defaultFeatureToggles;

  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
  );
}

function getConfigForRow(row: ChecklistConfigRow) {
  const enabledTabs = normalizeEnabledTabs(row.enabledTabs);
  return {
    enabledTabs,
    communicationChannels: normalizeChannels(row.communicationChannels, enabledTabs),
    featureToggles: normalizeFeatureToggles(row.featureToggles),
  };
}

function getApplicableForRow(row: ChecklistConfigRow) {
  return getApplicableItems(CONFIGURATOR_TEMPLATE, getConfigForRow(row));
}

function sameItemSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((id) => aSet.has(id));
}

async function getConfigRow(slug: string): Promise<ChecklistConfigRow> {
  const checklist = await prisma.checklist.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      clientName: true,
      version: true,
      configuratorChecklist: true,
      enabledTabs: true,
      communicationChannels: true,
      featureToggles: true,
    },
  });

  if (!checklist) {
    throw new ConfiguratorServiceError(`Checklist with slug "${slug}" not found`, 404);
  }

  return checklist as ChecklistConfigRow;
}

export async function generateConfiguratorChecklist(slug: string): Promise<ConfiguratorChecklistBlob> {
  const row = await getConfigRow(slug);
  const existing = asConfiguratorBlob(row.configuratorChecklist);
  if (existing) return existing;

  const now = new Date().toISOString();
  const applicable = getApplicableForRow(row);
  const blob = syncConfiguratorState(applicable, null, now);

  const updated = await prisma.checklist.update({
    where: { id: row.id },
    data: {
      configuratorChecklist: toPrismaJson(blob),
      version: { increment: 1 },
    },
    select: { configuratorChecklist: true },
  });

  return asConfiguratorBlob(updated.configuratorChecklist) ?? blob;
}

export async function getConfiguratorChecklist(
  slug: string,
  opts?: { includeArchived?: boolean }
): Promise<ConfiguratorChecklistBlob> {
  const row = await getConfigRow(slug);
  const existing = asConfiguratorBlob(row.configuratorChecklist);
  if (!existing) {
    throw new ConfiguratorServiceError("Configurator checklist has not been generated", 404);
  }

  if (opts?.includeArchived) return existing;

  return {
    ...existing,
    items: existing.items.filter((item) => !item.archived),
  };
}

export async function getConfiguratorProgress(slug: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  inProgressWithDependency: number;
  blocked: number;
  unset: number;
  bySection: Record<string, { total: number; completed: number; blocked: number }>;
  generatedAt: string;
  lastSnapshotAt: string;
  stale: boolean;
}> {
  const row = await getConfigRow(slug);
  const existing = asConfiguratorBlob(row.configuratorChecklist);
  if (!existing) {
    throw new ConfiguratorServiceError("Configurator checklist has not been generated", 404);
  }

  const itemMap = new Map(existing.items.map((item) => [item.itemId, item]));
  const templateMap = new Map(CONFIGURATOR_TEMPLATE.map((item) => [item.id, item]));
  const snapshotStates = existing.snapshotItemIds
    .map((itemId) => itemMap.get(itemId))
    .filter((item): item is ConfiguratorItemState => !!item && !item.archived);

  const counts = {
    total: existing.snapshotItemIds.length,
    completed: 0,
    inProgress: 0,
    inProgressWithDependency: 0,
    blocked: 0,
    unset: 0,
    bySection: {} as Record<string, { total: number; completed: number; blocked: number }>,
    generatedAt: existing.generatedAt,
    lastSnapshotAt: existing.lastSnapshotAt,
    stale: false,
  };

  for (const itemId of existing.snapshotItemIds) {
    const state = itemMap.get(itemId);
    const section = templateMap.get(itemId)?.section ?? "Unknown";
    counts.bySection[section] ??= { total: 0, completed: 0, blocked: 0 };
    counts.bySection[section].total += 1;

    if (!state || state.archived || state.status === null) {
      counts.unset += 1;
      continue;
    }

    if (state.status === "completed") {
      counts.completed += 1;
      counts.bySection[section].completed += 1;
    } else if (state.status === "in_progress") {
      counts.inProgress += 1;
    } else if (state.status === "in_progress_with_dependency") {
      counts.inProgressWithDependency += 1;
    } else if (state.status === "blocked") {
      counts.blocked += 1;
      counts.bySection[section].blocked += 1;
    }
  }

  counts.unset += Math.max(0, counts.total - snapshotStates.length - counts.unset);
  counts.stale = !sameItemSet(
    existing.snapshotItemIds,
    getApplicableForRow(row).map((item) => item.id)
  );

  return counts;
}

export async function updateConfiguratorItem(
  slug: string,
  input: {
    itemId: string;
    status: ConfiguratorStatus | null;
    notes: string | null;
    // Optional — when present, toggles the independent "configured" audit flag.
    // Tracked separately from status so the audit pass never collides with the
    // implementation pass.
    configured?: boolean;
    updatedBy: string;
  }
): Promise<ConfiguratorItemState> {
  let lastConflict = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await getConfigRow(slug);
    const existing = asConfiguratorBlob(row.configuratorChecklist);
    if (!existing) {
      throw new ConfiguratorServiceError("Configurator checklist has not been generated", 404);
    }

    const itemIndex = existing.items.findIndex((item) => item.itemId === input.itemId);
    if (itemIndex === -1) {
      throw new ConfiguratorServiceError(`Configurator item "${input.itemId}" not found`, 404);
    }

    const currentItem = existing.items[itemIndex];
    if (currentItem.archived) {
      throw new ConfiguratorServiceError(`Configurator item "${input.itemId}" is archived`, 422);
    }

    const now = new Date().toISOString();
    const statusChanged = currentItem.status !== input.status;
    const notesChanged = currentItem.notes !== input.notes;
    const configuredChanged =
      input.configured !== undefined && (currentItem.configured ?? false) !== input.configured;

    const updatedItem: ConfiguratorItemState = {
      ...currentItem,
      status: input.status,
      notes: input.notes,
      // `configured` has its own audit trail. When the caller doesn't supply
      // it, preserve whatever was already on the row.
      configured: input.configured !== undefined ? input.configured : currentItem.configured,
      configuredAt: configuredChanged
        ? input.configured
          ? now
          : null
        : currentItem.configuredAt,
      configuredBy: configuredChanged
        ? input.configured
          ? input.updatedBy
          : null
        : currentItem.configuredBy,
      updatedAt: statusChanged || notesChanged ? now : currentItem.updatedAt,
      updatedBy: statusChanged || notesChanged ? input.updatedBy : currentItem.updatedBy,
    };

    const nextBlob: ConfiguratorChecklistBlob = {
      ...existing,
      items: existing.items.map((item, index) => (index === itemIndex ? updatedItem : item)),
    };

    const updated = await prisma.checklist.updateMany({
      where: {
        id: row.id,
        version: row.version,
      },
      data: {
        configuratorChecklist: toPrismaJson(nextBlob),
        version: { increment: 1 },
      },
    });

    if (updated.count === 1) return updatedItem;
    lastConflict = true;
  }

  if (lastConflict) {
    throw new ConfiguratorServiceError("Version conflict while updating configurator checklist", 409);
  }

  throw new ConfiguratorServiceError("Failed to update configurator checklist", 500);
}

export async function refreshConfiguratorSnapshot(slug: string): Promise<ConfiguratorChecklistBlob> {
  const row = await getConfigRow(slug);
  const existing = asConfiguratorBlob(row.configuratorChecklist);
  if (!existing) {
    throw new ConfiguratorServiceError("Configurator checklist has not been generated", 404);
  }

  const now = new Date().toISOString();
  const blob = syncConfiguratorState(getApplicableForRow(row), existing, now);

  const updated = await prisma.checklist.update({
    where: { id: row.id },
    data: {
      configuratorChecklist: toPrismaJson(blob),
      version: { increment: 1 },
    },
    select: { configuratorChecklist: true },
  });

  return asConfiguratorBlob(updated.configuratorChecklist) ?? blob;
}

export async function getConfiguratorMeta(slug: string) {
  const row = await getConfigRow(slug);
  const blob = asConfiguratorBlob(row.configuratorChecklist);
  const applicableItems = getApplicableForRow(row);
  const stale = blob ? !sameItemSet(blob.snapshotItemIds, applicableItems.map((item) => item.id)) : false;

  return {
    id: row.id,
    slug: row.slug,
    clientName: row.clientName,
    version: row.version,
    generated: !!blob,
    blob,
    applicableItems,
    templateItems: CONFIGURATOR_TEMPLATE,
    stale,
  };
}
