import test from "node:test";
import assert from "node:assert/strict";
import { mergeValue, rebaseOntoServer } from "../src/lib/save-conflict-merge";
import type { ChecklistData, CustomTab } from "../src/lib/types";

type Row = { id: string; [key: string]: unknown };

function tab(id: string, rows: Row[], extra: Partial<CustomTab> = {}): CustomTab {
  return {
    id,
    slug: id,
    label: id,
    icon: "ClipboardCheck",
    fields: [],
    mode: "table",
    columns: [
      { key: "topic", label: "Topic", type: "text" },
      { key: "deck_proposal", label: "What the deck shows", type: "text" },
      { key: "your_answer", label: "Your answer", type: "textarea" },
    ],
    rows,
    ...extra,
  };
}

function checklist(fields: Record<string, unknown>, version = 10): ChecklistData {
  return { id: "c1", slug: "kalix", version, fieldVersions: {}, ...fields } as unknown as ChecklistData;
}

function rowsOf(data: ChecklistData, tabId: string): Row[] {
  const tabs = data.customTabs as CustomTab[];
  return (tabs.find((t) => t.id === tabId)?.rows ?? []) as Row[];
}

const botFlowRows = (): Row[] => [
  { id: "r1", topic: "Welcome message", deck_proposal: "Hi! Welcome to Kalix.", your_answer: "" },
  { id: "r2", topic: "Language", deck_proposal: "Slide 9", your_answer: "" },
  { id: "r3", topic: "Never answer", deck_proposal: "Slide 16", your_answer: "" },
];

test("the client's typed answer survives an admin rewording another column of the same row", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "Hello from Kalix!" } : r)))];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, deck_proposal: "Slide 10: Hi!" } : r)))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  const row = merged[0].rows![0];
  assert.equal(row.your_answer, "Hello from Kalix!");
  assert.equal(row.deck_proposal, "Slide 10: Hi!");
});

test("an edit to one custom tab and an edit to another custom tab both survive", () => {
  const base = [tab("bot", botFlowRows()), tab("privacy", [{ id: "p1", topic: "Consent", your_answer: "" }])];
  const mine = [
    tab("bot", botFlowRows().map((r) => (r.id === "r2" ? { ...r, your_answer: "Taglish" } : r))),
    tab("privacy", [{ id: "p1", topic: "Consent", your_answer: "" }]),
  ];
  const theirs = [
    tab("bot", botFlowRows()),
    tab("privacy", [{ id: "p1", topic: "Consent", your_answer: "Yes, we consent" }]),
  ];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.equal(merged[0].rows![1].your_answer, "Taglish");
  assert.equal(merged[1].rows![0].your_answer, "Yes, we consent");
});

test("different rows of the same tab, edited on each side, both survive", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r3" ? { ...r, your_answer: "theirs" } : r)))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.your_answer),
    ["mine", "", "theirs"]
  );
});

test("when both sides change the same cell, the person typing wins", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "theirs" } : r)))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.equal(merged[0].rows![0].your_answer, "mine");
});

test("a row someone else added is kept, and the typed edit is kept", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))];
  const theirs = [tab("bot", [...botFlowRows(), { id: "r4", topic: "New row", deck_proposal: "", your_answer: "" }])];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.id),
    ["r1", "r2", "r3", "r4"]
  );
  assert.equal(merged[0].rows![0].your_answer, "mine");
});

test("a row added on this page lands after the row before it, next to the server's changes", () => {
  const base = [tab("bot", botFlowRows())];
  const added: Row = { id: "mine-1", topic: "Added here", deck_proposal: "", your_answer: "typed" };
  const mine = [tab("bot", [botFlowRows()[0], added, botFlowRows()[1], botFlowRows()[2]])];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r3" ? { ...r, deck_proposal: "edited" } : r)))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.id),
    ["r1", "mine-1", "r2", "r3"]
  );
  assert.equal(merged[0].rows![3].deck_proposal, "edited");
});

test("a row deleted here is removed if the server did not touch it, kept if the server edited it", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().filter((r) => r.id !== "r1" && r.id !== "r2"))];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r2" ? { ...r, your_answer: "someone typed this" } : r)))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.id),
    ["r2", "r3"]
  );
  assert.equal(merged[0].rows![0].your_answer, "someone typed this");
});

test("a row the server deleted is dropped if untouched here, but kept if this person typed in it", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r2" ? { ...r, your_answer: "typed here" } : r)))];
  const theirs = [tab("bot", botFlowRows().filter((r) => r.id === "r3"))];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.id),
    ["r2", "r3"]
  );
  assert.equal(merged[0].rows![0].your_answer, "typed here");
});

test("tab settings changed on the server (label) come through while rows typed here are kept", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))];
  const theirs = [tab("bot", botFlowRows(), { label: "Bot Flow and Setup" })];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.equal(merged[0].label, "Bot Flow and Setup");
  assert.equal(merged[0].rows![0].your_answer, "mine");
});

test("a tab with no rows yet merges with rows added on the other side", () => {
  const base = [tab("empty", [])];
  const mine = [tab("empty", [{ id: "n1", topic: "typed", deck_proposal: "", your_answer: "" }])];
  const theirs = [tab("empty", [{ id: "n2", topic: "from server", deck_proposal: "", your_answer: "" }])];

  const merged = mergeValue(base, mine, theirs) as CustomTab[];
  assert.deepEqual(
    merged[0].rows!.map((r) => r.id).sort(),
    ["n1", "n2"]
  );
});

test("form tab answers (customData) merge answer by answer", () => {
  const base = { formTab: { values: { name: "", email: "" }, updatedAt: "t0" } };
  const mine = { formTab: { values: { name: "Janus", email: "" }, updatedAt: "t1" } };
  const theirs = { formTab: { values: { name: "", email: "j@example.com" }, updatedAt: "t2" } };

  const merged = mergeValue(base, mine, theirs) as typeof base;
  assert.equal(merged.formTab.values.name, "Janus");
  assert.equal(merged.formTab.values.email, "j@example.com");
});

test("rebase: takes the server's version and content for fields this page did not edit", () => {
  const baseTabs = [tab("bot", botFlowRows())];
  const base = checklist({ customTabs: baseTabs, users: [{ id: "u1", name: "old" }] }, 10);
  const mine = checklist(
    { customTabs: [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))], users: [{ id: "u1", name: "old" }] },
    10
  );
  const theirs = checklist(
    { customTabs: [tab("bot", botFlowRows().map((r) => (r.id === "r3" ? { ...r, your_answer: "theirs" } : r)))], users: [{ id: "u1", name: "changed on server" }] },
    14
  );

  const result = rebaseOntoServer({ base, mine, theirs, dirtyFields: ["customTabs"], conflictedFields: ["customTabs"] });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.next.version, 14);
  assert.deepEqual((result.next.users as unknown as Array<{ name: string }>)[0].name, "changed on server");
  assert.deepEqual(
    rowsOf(result.next, "bot").map((r) => r.your_answer),
    ["mine", "", "theirs"]
  );
});

test("rebase: a dirty field the server did not touch keeps the on-screen value", () => {
  const base = checklist({ customTabs: [tab("bot", botFlowRows())], users: [{ id: "u1", name: "old" }] }, 10);
  const mine = checklist(
    {
      customTabs: [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))],
      users: [{ id: "u1", name: "edited here" }],
    },
    10
  );
  const theirs = checklist({ customTabs: [tab("bot", botFlowRows(), { label: "Renamed" })], users: [{ id: "u1", name: "old" }] }, 12);

  const result = rebaseOntoServer({ base, mine, theirs, dirtyFields: ["customTabs", "users"], conflictedFields: ["customTabs"] });
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal((result.next.users as unknown as Array<{ name: string }>)[0].name, "edited here");
  assert.equal((result.next.customTabs as CustomTab[])[0].label, "Renamed");
});

test("rebase: a conflict on a field that cannot be merged piece by piece is reported, not guessed", () => {
  const base = checklist({ users: [{ id: "u1", name: "a" }] }, 10);
  const mine = checklist({ users: [{ id: "u1", name: "b" }] }, 10);
  const theirs = checklist({ users: [{ id: "u1", name: "c" }] }, 12);

  const result = rebaseOntoServer({ base, mine, theirs, dirtyFields: ["users"], conflictedFields: ["users"] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.unmergeable, ["users"]);
});

test("merging never changes its inputs", () => {
  const base = [tab("bot", botFlowRows())];
  const mine = [tab("bot", botFlowRows().map((r) => (r.id === "r1" ? { ...r, your_answer: "mine" } : r)))];
  const theirs = [tab("bot", botFlowRows().map((r) => (r.id === "r2" ? { ...r, your_answer: "theirs" } : r)))];
  const snapshot = JSON.stringify({ base, mine, theirs });

  mergeValue(base, mine, theirs);
  assert.equal(JSON.stringify({ base, mine, theirs }), snapshot);
});
