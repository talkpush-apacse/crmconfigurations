import test from "node:test";
import assert from "node:assert/strict";
import { nameKey, sameCompanyName, suggestAccount } from "../src/lib/companies/names";
import { groupUnassigned, unassignedTotal } from "../src/lib/companies/unassigned";
import { arrangeGallery, attentionTotal, describeAttention, filterCompanies, sortCompanies, type CompanyCardData } from "../src/lib/companies/gallery";

test("company names: punctuation, case and corporate endings do not make two companies", () => {
  assert.equal(sameCompanyName("McDonald's PH", "mcdonalds ph"), true);
  assert.equal(sameCompanyName("Acme, Inc.", "ACME"), true);
  assert.equal(sameCompanyName("Acme Corporation", "Acme Co"), true);
  assert.equal(sameCompanyName("Acme PH", "Acme"), false, "a different place is a different company until staff say otherwise");
  assert.equal(sameCompanyName("", ""), false, "two blanks are not a match");
  assert.equal(nameKey("Inc."), "inc", "a name made only of corporate words keeps them");
});

test("company names: a suggestion needs exactly one match", () => {
  const accounts = [{ id: "1", name: "Acme" }, { id: "2", name: "Globex" }];
  assert.equal(suggestAccount("acme inc", accounts)?.id, "1");
  assert.equal(suggestAccount("Initech", accounts), null);
  assert.equal(suggestAccount("Acme", [...accounts, { id: "3", name: "ACME Inc." }]), null, "two matches means we cannot tell");
});

const wf = (id: string, clientName: string, workflowName = "Flow") => ({ id, clientName, workflowName, status: "draft", updatedAt: "2026-10-07T00:00:00.000Z" });
const cl = (id: string, clientName: string) => ({ id, clientName, slug: id, updatedAt: "2026-10-07T00:00:00.000Z" });

test("holding area: items typed with the same client name are filed together, however it was spelled", () => {
  const groups = groupUnassigned(
    [cl("c1", "McDonald's PH"), cl("c2", "Acme")],
    [wf("w1", "mcdonalds ph"), wf("w2", "McDonald's PH"), wf("w3", "Initech")],
    [{ id: "a1", name: "Acme" }]
  );
  assert.equal(groups.length, 3);
  const mc = groups[0];
  assert.equal(mc.clientName, "McDonald's PH", "the spelling used most often");
  assert.equal(mc.checklists.length, 1);
  assert.equal(mc.workflows.length, 2);
  assert.equal(unassignedTotal(groups), 5);
});

test("holding area: a matching company is only a suggestion, and the biggest group comes first", () => {
  const groups = groupUnassigned([cl("c1", "Acme")], [wf("w1", "Acme"), wf("w2", "Zed")], [{ id: "a1", name: "Acme Inc" }]);
  assert.equal(groups[0].clientName, "Acme");
  assert.deepEqual(groups[0].suggestion, { id: "a1", name: "Acme Inc" });
  assert.equal(groups[1].suggestion, null);
});

const card = (over: Partial<CompanyCardData>): CompanyCardData => ({
  id: over.name ?? "x", name: "X", slug: "x", notes: null, companyId: null, companyName: null, geo: null, geoCode: null, checklistCount: 0, workflowCount: 0, projectCount: 0,
  attention: { openComments: 0, pendingSuggestions: 0, openRequests: 0 }, lastActivityAt: "2026-10-01T00:00:00.000Z", ...over,
});

test("gallery: search matches part of a name, ignoring case", () => {
  const list = [card({ name: "Acme" }), card({ name: "Globex" }), card({ name: "Mercury" })];
  assert.deepEqual(filterCompanies(list, " ACM ").map((c) => c.name), ["Acme"]);
  assert.equal(filterCompanies(list, "").length, 3);
});

test("gallery: sort by recent activity, by name, or by what needs attention", () => {
  const list = [
    card({ name: "Bravo", lastActivityAt: "2026-10-02T00:00:00.000Z" }),
    card({ name: "Alpha", lastActivityAt: "2026-10-05T00:00:00.000Z", attention: { openComments: 1, pendingSuggestions: 0, openRequests: 0 } }),
    card({ name: "Charlie", lastActivityAt: "2026-10-03T00:00:00.000Z", attention: { openComments: 2, pendingSuggestions: 1, openRequests: 1 } }),
  ];
  assert.deepEqual(sortCompanies(list, "recent").map((c) => c.name), ["Alpha", "Charlie", "Bravo"]);
  assert.deepEqual(sortCompanies(list, "name").map((c) => c.name), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(sortCompanies(list, "attention").map((c) => c.name), ["Charlie", "Alpha", "Bravo"]);
  assert.equal(attentionTotal(list[2].attention), 4);
  assert.deepEqual(list.map((c) => c.name), ["Bravo", "Alpha", "Charlie"], "sorting never reorders the list it was given");
});

test("gallery: what is waiting is described in words, and left blank when nothing is", () => {
  assert.equal(describeAttention({ openComments: 2, pendingSuggestions: 1, openRequests: 1 }), "2 open comments, 1 suggestion waiting, 1 access request");
  assert.equal(describeAttention({ openComments: 1, pendingSuggestions: 0, openRequests: 0 }), "1 open comment");
  assert.equal(describeAttention({ openComments: 0, pendingSuggestions: 0, openRequests: 0 }), "");
});

const acct = (name: string, companyId: string | null, companyName: string | null, geo: string | null, geoCode: string | null, at: string) =>
  card({ name, companyId, companyName, geo, geoCode, lastActivityAt: at });

test("gallery: search also finds an account by its company or its geo", () => {
  const list = [acct("Concentrix PH", "c1", "Concentrix", "Philippines", "PH", "2026-10-01T00:00:00.000Z"), acct("Globex US", "g1", "Globex", "United States", "US", "2026-10-01T00:00:00.000Z"), card({ name: "TP Philippines" })];
  assert.deepEqual(filterCompanies(list, "concentrix").map((c) => c.name), ["Concentrix PH"]);
  assert.deepEqual(filterCompanies(list, "philippines").map((c) => c.name).sort(), ["Concentrix PH", "TP Philippines"].sort());
  assert.deepEqual(filterCompanies(list, " us ").map((c) => c.name), ["Globex US"]);
});

test("gallery: a company with several accounts is shown as one group, a lone account as a card", () => {
  const sorted = [
    acct("Concentrix PH", "c1", "Concentrix", "Philippines", "PH", "2026-10-05T00:00:00.000Z"),
    card({ name: "TP Philippines", lastActivityAt: "2026-10-04T00:00:00.000Z" }),
    acct("Concentrix US", "c1", "Concentrix", "United States", "US", "2026-10-03T00:00:00.000Z"),
    acct("Globex UK", "g1", "Globex", "United Kingdom", "UK", "2026-10-02T00:00:00.000Z"),
  ];
  const units = arrangeGallery(sorted);
  assert.deepEqual(units.map((u) => (u.kind === "company" ? `company:${u.name}:${u.cards.map((c) => c.name).join(",")}` : `account:${u.card.name}`)), [
    "company:Concentrix:Concentrix PH,Concentrix US",
    "account:TP Philippines",
    "account:Globex UK",
  ]);
});

test("gallery: arranging never drops or repeats an account", () => {
  const sorted = [
    acct("A PH", "a", "A", "Philippines", "PH", "2026-10-05T00:00:00.000Z"),
    acct("B US", "b", "B", "United States", "US", "2026-10-04T00:00:00.000Z"),
    acct("A US", "a", "A", "United States", "US", "2026-10-03T00:00:00.000Z"),
    card({ name: "Loose" }),
    acct("B IN", "b", "B", "India", "IN", "2026-10-02T00:00:00.000Z"),
  ];
  const flat = arrangeGallery(sorted).flatMap((u) => (u.kind === "company" ? u.cards : [u.card])).map((c) => c.name).sort();
  assert.deepEqual(flat, sorted.map((c) => c.name).sort());
});
