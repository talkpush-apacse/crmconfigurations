/**
 * "Maria is editing" chips. Kept in memory, so on a serverless host it only sees visitors who happen to be served
 * by the same running instance. That is fine for a courtesy hint; the real protection against two people
 * overwriting each other is the revision check, which does not depend on this.
 */

const TTL_MS = 45_000;
const book = new Map<string, Map<string, { name: string; editing: boolean; at: number }>>();

export function touchPresence(workflowId: string, key: string, name: string, editing: boolean, now = Date.now()) {
  let room = book.get(workflowId);
  if (!room) book.set(workflowId, (room = new Map()));
  room.set(key, { name, editing, at: now });
  prune(room, now);
}

/** Other people active on this workflow right now. */
export function othersPresent(workflowId: string, myKey: string, now = Date.now()): { name: string; editing: boolean }[] {
  const room = book.get(workflowId);
  if (!room) return [];
  prune(room, now);
  return [...room.entries()].filter(([k]) => k !== myKey).map(([, v]) => ({ name: v.name, editing: v.editing }));
}

function prune(room: Map<string, { at: number }>, now: number) {
  for (const [k, v] of room) if (now - v.at > TTL_MS) room.delete(k);
}
