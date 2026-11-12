import test from "node:test";
import assert from "node:assert/strict";
import type { ChecklistData } from "../src/lib/types";
import {
  BACKUP_MAX_AGE_MS,
  backupKey,
  buildEntry,
  newestSavedAt,
  parseEntries,
  planRestore,
  readEntries,
  withEntry,
  withoutWriters,
  writeEntries,
  type BackupEntry,
} from "../src/lib/unsaved-backup";

const NOW = 1_800_000_000_000;

function checklist(overrides: Record<string, unknown> = {}): ChecklistData {
  return { id: "c1", slug: "demo", version: 5, customTabs: null, users: null, ...overrides } as unknown as ChecklistData;
}

function tab(rows: Array<{ id: string; answer: string }>) {
  return [{ id: "t1", name: "Bot Flow", mode: "table", rows }];
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function entryFor(base: ChecklistData, mine: ChecklistData, writerId = "w1", dirtyFields = ["customTabs"], savedAt = NOW) {
  const entry = buildEntry({ writerId, now: savedAt, base, mine, dirtyFields });
  assert.ok(entry);
  return entry;
}

test("builds an entry from only the fields with unsaved edits", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "Yes, 24/7" }]), users: [{ id: "u1" }] });
  const entry = buildEntry({ writerId: "w1", now: NOW, base, mine, dirtyFields: ["customTabs"] });
  assert.deepEqual(Object.keys(entry!.mine), ["customTabs"]);
  assert.equal(entry!.baseVersion, 5);
  assert.deepEqual(entry!.base.customTabs, base.customTabs);
});

test("nothing is kept when the edit was put back or no field is unsaved", () => {
  const same = checklist({ customTabs: tab([{ id: "r1", answer: "A" }]) });
  assert.equal(buildEntry({ writerId: "w", now: NOW, base: same, mine: same, dirtyFields: ["customTabs"] }), null);
  assert.equal(buildEntry({ writerId: "w", now: NOW, base: same, mine: same, dirtyFields: [] }), null);
});

test("fields that are not editable checklist content are never stored or restored", () => {
  const base = checklist();
  const mine = checklist({ version: 99, slug: "hacked" });
  assert.equal(buildEntry({ writerId: "w", now: NOW, base, mine, dirtyFields: ["version", "slug", "id"] }), null);

  const forged: BackupEntry = { writerId: "x", savedAt: NOW, baseVersion: 5, base: { version: 5 }, mine: { version: 99 } };
  assert.deepEqual(planRestore([forged], checklist()).fields, []);
});

test("restores typed answers that never reached the server", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "Yes" }, { id: "r2", answer: "No" }]) });
  const entry = entryFor(base, mine);
  const plan = planRestore([entry], base);
  assert.deepEqual(plan.fields, ["customTabs"]);
  assert.deepEqual(plan.changes.customTabs, mine.customTabs);
  assert.equal(plan.serverMoved, false);
});

test("a cell someone else changed meanwhile keeps the newer saved value; other typed cells still come back", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "mine 1" }, { id: "r2", answer: "mine 2" }]) });
  const entry = entryFor(base, mine);
  const server = checklist({
    version: 6,
    customTabs: tab([{ id: "r1", answer: "colleague 1" }, { id: "r2", answer: "" }]),
  });
  const plan = planRestore([entry], server);
  assert.equal(plan.serverMoved, true);
  assert.deepEqual(plan.changes.customTabs, tab([{ id: "r1", answer: "colleague 1" }, { id: "r2", answer: "mine 2" }]));
});

test("nothing to restore once the same text is already saved", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "Yes" }]) });
  const entry = entryFor(base, mine);
  const alreadySaved = checklist({ version: 6, customTabs: tab([{ id: "r1", answer: "Yes" }]) });
  assert.deepEqual(planRestore([entry], alreadySaved).fields, []);
});

test("a row typed into a tab that someone deleted meanwhile is brought back, not lost", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "typed" }]) });
  const entry = entryFor(base, mine);
  const server = checklist({ version: 6, customTabs: tab([{ id: "r1", answer: "" }]) });
  const plan = planRestore([entry], server);
  assert.deepEqual(plan.changes.customTabs, tab([{ id: "r1", answer: "" }, { id: "r2", answer: "typed" }]));
});

test("a field that cannot be merged cell by cell is only restored if the server copy is unchanged", () => {
  const base = checklist({ users: [{ id: "u1", name: "A" }] });
  const mine = checklist({ users: [{ id: "u1", name: "B" }] });
  const entry = entryFor(base, mine, "w1", ["users"]);
  assert.deepEqual(planRestore([entry], base).changes.users, mine.users);

  const serverChanged = checklist({ version: 6, users: [{ id: "u1", name: "C" }] });
  assert.deepEqual(planRestore([entry], serverChanged).fields, [], "newer saved users stay as they are");
});

test("several entries apply oldest first, and the later one cannot erase the earlier one's other cells", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "" }]) });
  const first = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "one" }, { id: "r2", answer: "" }]) }), "w-old", ["customTabs"], NOW - 1000);
  const second = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "" }, { id: "r2", answer: "two" }]) }), "w-new", ["customTabs"], NOW);
  const plan = planRestore([second, first], base);
  assert.deepEqual(plan.changes.customTabs, tab([{ id: "r1", answer: "one" }, { id: "r2", answer: "two" }]));
});

test("stored text that is damaged, old, or the wrong shape is ignored without throwing", () => {
  assert.deepEqual(parseEntries(null, NOW), []);
  assert.deepEqual(parseEntries("", NOW), []);
  assert.deepEqual(parseEntries("{not json", NOW), []);
  assert.deepEqual(parseEntries(JSON.stringify({ v: 0, entries: [] }), NOW), []);
  assert.deepEqual(parseEntries(JSON.stringify({ v: 1, entries: "nope" }), NOW), []);
  assert.deepEqual(parseEntries(JSON.stringify({ v: 1, entries: [null, 3, { writerId: "" }] }), NOW), []);
});

test("entries older than 14 days are dropped", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }]) });
  const mine = checklist({ customTabs: tab([{ id: "r1", answer: "x" }]) });
  const old = entryFor(base, mine, "w-old", ["customTabs"], NOW - BACKUP_MAX_AGE_MS - 1);
  const fresh = entryFor(base, mine, "w-new", ["customTabs"], NOW - BACKUP_MAX_AGE_MS + 1000);
  const raw = JSON.stringify({ v: 1, entries: [old, fresh] });
  assert.deepEqual(parseEntries(raw, NOW).map((e) => e.writerId), ["w-new"]);
});

test("a page replaces only its own entry and never touches another page's", () => {
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }]) });
  const a1 = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "a1" }]) }), "A");
  const b1 = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "b1" }]) }), "B");
  const a2 = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "a2" }]) }), "A");
  const list = withEntry(withEntry([], a1), b1);
  const updated = withEntry(list, a2);
  assert.equal(updated.length, 2);
  assert.deepEqual(updated.find((e) => e.writerId === "A")!.mine, a2.mine);
  assert.deepEqual(updated.find((e) => e.writerId === "B"), b1);
  assert.deepEqual(withoutWriters(updated, ["A"]).map((e) => e.writerId), ["B"]);
  assert.equal(newestSavedAt([a1, b1]), NOW);
  assert.equal(newestSavedAt([]), 0);
});

test("write then read round-trips, and an empty list removes the key", () => {
  const storage = memoryStorage();
  const key = backupKey("slug", "demo");
  const base = checklist({ customTabs: tab([{ id: "r1", answer: "" }]) });
  const entry = entryFor(base, checklist({ customTabs: tab([{ id: "r1", answer: "kept" }]) }));
  assert.deepEqual(writeEntries(storage, key, [entry]), { ok: true });
  assert.deepEqual(readEntries(storage, key, NOW), [entry]);
  assert.deepEqual(writeEntries(storage, key, []), { ok: true });
  assert.equal(storage.map.has(key), false);
});

test("blocked or full storage is reported, not hidden, and reading never throws", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(writeEntries(broken, "k", [entryFor(checklist({ customTabs: [] }), checklist({ customTabs: [{ id: "a" }] }))]), { ok: false });
  assert.deepEqual(writeEntries(broken, "k", []), { ok: false });
  assert.deepEqual(readEntries(broken, "k", NOW), []);
});

test("each link gets its own storage key", () => {
  assert.notEqual(backupKey("slug", "a"), backupKey("slug", "b"));
  assert.notEqual(backupKey("slug", "a"), backupKey("token", "a"));
});
