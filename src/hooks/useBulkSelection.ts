"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Set-based bulk selection hook for tables/lists.
 *
 * Features:
 * - Toggle a single id (and remember it as the shift-click anchor)
 * - Shift-click range selection between the anchor and the latest click
 * - Toggle-all over a list of ids (visible items)
 * - O(1) lookup via Set<string>
 *
 * Selection is intentionally tracked by stable row id (not index), so
 * pagination, sort, drag-reorder, or filtering doesn't corrupt it.
 */
export interface BulkSelection {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  count: number;
  toggle: (id: string, opts?: { index?: number; shiftKey?: boolean; allIds?: string[] }) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  /** True if every id in `ids` is selected. */
  allSelected: (ids: string[]) => boolean;
  /** True if some-but-not-all ids in `ids` are selected. */
  someSelected: (ids: string[]) => boolean;
}

export function useBulkSelection(): BulkSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lastIndexRef = useRef<number | null>(null);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback(
    (
      id: string,
      opts?: { index?: number; shiftKey?: boolean; allIds?: string[] },
    ) => {
      const { index, shiftKey, allIds } = opts ?? {};
      if (
        shiftKey &&
        index !== undefined &&
        allIds &&
        lastIndexRef.current !== null
      ) {
        const from = Math.min(lastIndexRef.current, index);
        const to = Math.max(lastIndexRef.current, index);
        const rangeIds = allIds.slice(from, to + 1);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      if (index !== undefined) lastIndexRef.current = index;
    },
    [],
  );

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allOn) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    lastIndexRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    lastIndexRef.current = null;
  }, []);

  const allSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds],
  );

  const someSelected = useCallback(
    (ids: string[]) =>
      ids.some((id) => selectedIds.has(id)) && !ids.every((id) => selectedIds.has(id)),
    [selectedIds],
  );

  return useMemo(
    () => ({
      selectedIds,
      isSelected,
      count: selectedIds.size,
      toggle,
      toggleAll,
      clear,
      allSelected,
      someSelected,
    }),
    [selectedIds, isSelected, toggle, toggleAll, clear, allSelected, someSelected],
  );
}
