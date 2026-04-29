import type { ChecklistJsonField, NotificationPendingChanges } from "@/lib/types";

export type ChangeSummary = NotificationPendingChanges | null;

type ArrayResolver = (data: unknown) => unknown[];

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function diffArray(oldArr: unknown[], newArr: unknown[]): ChangeSummary {
  let rowsChanged = 0;

  const oldHasIds = oldArr.every(
    (row) => !!row && typeof row === "object" && "id" in (row as Record<string, unknown>)
  );
  const newHasIds = newArr.every(
    (row) => !!row && typeof row === "object" && "id" in (row as Record<string, unknown>)
  );

  if (oldHasIds && newHasIds) {
    const oldMap = new Map(
      oldArr.map((row) => [String((row as Record<string, unknown>).id), stableSerialize(row)])
    );
    const newMap = new Map(
      newArr.map((row) => [String((row as Record<string, unknown>).id), stableSerialize(row)])
    );

    for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
      if (oldMap.get(id) !== newMap.get(id)) {
        rowsChanged += 1;
      }
    }
  } else {
    const oldSerialized = oldArr.map((row) => stableSerialize(row));
    const newSerialized = newArr.map((row) => stableSerialize(row));
    const maxLength = Math.max(oldSerialized.length, newSerialized.length);

    for (let index = 0; index < maxLength; index += 1) {
      if (oldSerialized[index] !== newSerialized[index]) {
        rowsChanged += 1;
      }
    }
  }

  if (rowsChanged === 0) return null;

  return {
    rowsChanged,
    summary: `${rowsChanged} ${rowsChanged === 1 ? "row changed" : "rows changed"}`,
  };
}

function diffObject(oldObj: unknown, newObj: unknown): ChangeSummary {
  const oldRecord = oldObj && typeof oldObj === "object" ? oldObj as Record<string, unknown> : {};
  const newRecord = newObj && typeof newObj === "object" ? newObj as Record<string, unknown> : {};
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  let fieldsChanged = 0;
  for (const key of keys) {
    if (stableSerialize(oldRecord[key]) !== stableSerialize(newRecord[key])) {
      fieldsChanged += 1;
    }
  }

  if (fieldsChanged === 0) return null;

  return {
    fieldsChanged,
    summary: `${fieldsChanged} ${fieldsChanged === 1 ? "field updated" : "fields updated"}`,
  };
}

const tableResolvers: Partial<Record<ChecklistJsonField, ArrayResolver>> = {
  users: normalizeArray,
  campaigns: normalizeArray,
  sites: normalizeArray,
  sources: normalizeArray,
  folders: normalizeArray,
  documents: normalizeArray,
  agencyPortal: normalizeArray,
  aiCallFaqs: (value) => {
    if (!value || typeof value !== "object") return [];
    return normalizeArray((value as Record<string, unknown>).faqs);
  },
};

const formTabs = new Set<ChecklistJsonField>([
  "companyInfo",
  "fbWhatsapp",
  "instagram",
  "prescreening",
  "messaging",
]);

export function getChangeSummary(
  tabId: string,
  oldData: unknown,
  newData: unknown
): ChangeSummary {
  const tableResolver = tableResolvers[tabId as ChecklistJsonField];
  if (tableResolver) {
    return diffArray(tableResolver(oldData), tableResolver(newData));
  }

  if (formTabs.has(tabId as ChecklistJsonField)) {
    return diffObject(oldData, newData);
  }

  return diffObject(oldData, newData);
}

export function mergePending(
  existing: NotificationPendingChanges | null | undefined,
  incoming: NotificationPendingChanges | null
): NotificationPendingChanges | null {
  if (!incoming) return existing ?? null;
  if (!existing) return incoming;

  const rowsChanged = (existing.rowsChanged ?? 0) + (incoming.rowsChanged ?? 0);
  const fieldsChanged = (existing.fieldsChanged ?? 0) + (incoming.fieldsChanged ?? 0);

  const merged: NotificationPendingChanges = {
    summary: "",
  };

  if (rowsChanged > 0) merged.rowsChanged = rowsChanged;
  if (fieldsChanged > 0) merged.fieldsChanged = fieldsChanged;

  if (rowsChanged > 0 && fieldsChanged > 0) {
    merged.summary = `${rowsChanged} rows changed, ${fieldsChanged} fields updated`;
  } else if (rowsChanged > 0) {
    merged.summary = `${rowsChanged} ${rowsChanged === 1 ? "row changed" : "rows changed"}`;
  } else {
    merged.summary = `${fieldsChanged} ${fieldsChanged === 1 ? "field updated" : "fields updated"}`;
  }

  return merged;
}
