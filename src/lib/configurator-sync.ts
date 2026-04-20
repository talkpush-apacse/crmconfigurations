import type {
  ConfiguratorChecklistBlob,
  ConfiguratorItemState,
  ConfiguratorTemplateItem,
} from "@/lib/configurator-template";

// Called on first generation AND on user-triggered "Refresh from settings".
// NEVER called implicitly on page load — the snapshot is stable until the SE asks to refresh.
export function syncConfiguratorState(
  applicable: ConfiguratorTemplateItem[],
  existing: ConfiguratorChecklistBlob | null,
  now: string
): ConfiguratorChecklistBlob {
  const applicableIds = new Set(applicable.map((item) => item.id));
  const existingItems = existing?.items ?? [];
  const existingMap = new Map(existingItems.map((state) => [state.itemId, state]));

  // Merge strategy:
  // - Keep every existing item, even if no longer applicable (soft archive).
  // - Items no longer applicable: archived = true (status/notes preserved).
  // - Items newly applicable but never seen: create fresh state.
  // - Items previously archived that became applicable again: un-archive, preserve status/notes.

  const merged: ConfiguratorItemState[] = [];

  // 1. Preserve all existing states, flipping archived based on current applicability.
  for (const existingState of existingItems) {
    merged.push({
      ...existingState,
      archived: !applicableIds.has(existingState.itemId),
    });
  }

  // 2. Add fresh states for brand-new applicable items.
  for (const item of applicable) {
    if (!existingMap.has(item.id)) {
      merged.push({
        itemId: item.id,
        status: null,
        notes: null,
        createdAt: now,
        updatedAt: null,
        updatedBy: null,
        archived: false,
      });
    }
  }

  return {
    items: merged,
    snapshotItemIds: applicable.map((item) => item.id),
    generatedAt: existing?.generatedAt ?? now,
    lastSnapshotAt: now,
  };
}
