import { getChangeSummary, mergePending } from "@/lib/change-summary";
import { isNotifiableTabField } from "@/lib/notifications";
import type { ChecklistJsonField, NotificationState } from "@/lib/types";

type ChecklistFieldMap = Partial<Record<ChecklistJsonField, unknown>>;

function cloneNotificationState(state: NotificationState | null | undefined): NotificationState {
  if (!state) return {};
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as NotificationState;
}

export function accumulateNotificationState(params: {
  currentState: NotificationState | null | undefined;
  previousData: ChecklistFieldMap;
  nextData: ChecklistFieldMap;
  changedFields: ChecklistJsonField[];
  editedAt?: string;
}): {
  notificationState: NotificationState | null;
  changed: boolean;
} {
  const { currentState, previousData, nextData, changedFields, editedAt = new Date().toISOString() } = params;

  const nextState = cloneNotificationState(currentState);
  let changed = false;

  for (const field of changedFields) {
    if (!isNotifiableTabField(field)) continue;

    const summary = getChangeSummary(field, previousData[field], nextData[field]);
    if (!summary) continue;

    const existingEntry = nextState[field];
    nextState[field] = {
      lastEditAt: editedAt,
      lastNotifiedAt: existingEntry?.lastNotifiedAt ?? null,
      pendingChanges: mergePending(existingEntry?.pendingChanges, summary),
    };
    changed = true;
  }

  return {
    notificationState: changed ? nextState : currentState ?? null,
    changed,
  };
}
