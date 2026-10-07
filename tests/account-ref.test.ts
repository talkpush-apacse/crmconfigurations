import test from "node:test";
import assert from "node:assert/strict";
import { describeAccountProblem, matchAccountRef, type AccountRow } from "../src/lib/accounts/account-ref";

const rows: AccountRow[] = [
  { id: "a1", name: "Acme Demo Corp" },
  { id: "g1", name: "Globex" },
  { id: "g2", name: "globex " },
  { id: "o1", name: "Old Co", archived: true },
  { id: "n1", name: "Northwind Traders" },
];

test("account reference: an id, or an exact name ignoring capitals and spaces, is accepted", () => {
  assert.equal(matchAccountRef(rows, "a1").kind, "one");
  const byName = matchAccountRef(rows, "  acme   DEMO corp ");
  assert.equal(byName.kind === "one" && byName.account.id, "a1");
});

test("account reference: a near miss is never accepted, only offered back", () => {
  const r = matchAccountRef(rows, "Acme");
  assert.equal(r.kind, "none");
  assert.deepEqual(r.kind === "none" && r.close.map((c) => c.id), ["a1"]);
  const msg = describeAccountProblem("Acme", r as never);
  assert.match(msg, /No account is called "Acme"/);
  assert.match(msg, /Did you mean: Acme Demo Corp \(a1\)/);
  assert.match(msg, /list_accounts/);
  assert.match(msg, /Needs an account/);
});

test("account reference: two companies with the same name are not guessed between", () => {
  const r = matchAccountRef(rows, "Globex");
  assert.equal(r.kind, "many");
  assert.match(describeAccountProblem("Globex", r as never), /Pass the id/);
});

test("account reference: an archived account cannot be filed under, by id or by name", () => {
  assert.equal(matchAccountRef(rows, "o1").kind, "archived");
  assert.equal(matchAccountRef(rows, "Old Co").kind, "archived");
  assert.match(describeAccountProblem("Old Co", matchAccountRef(rows, "Old Co") as never), /archived/);
});

test("account reference: nothing close says so plainly, and a blank is not an account", () => {
  const r = matchAccountRef(rows, "Initech");
  assert.deepEqual(r, { kind: "none", close: [] });
  assert.doesNotMatch(describeAccountProblem("Initech", r as never), /Did you mean/);
  assert.equal(matchAccountRef(rows, "   ").kind, "none");
});
