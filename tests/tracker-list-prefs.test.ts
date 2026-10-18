import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFS, parsePrefs } from "../src/lib/tracker/list-prefs";

test("nothing saved gives the defaults: compact, Phase and Owner side off", () => {
  const p = parsePrefs(null);
  assert.equal(p.density, "compact");
  assert.deepEqual(p.columns, { status: true, owner: true, side: false, phase: false, due: true });
  assert.deepEqual(parsePrefs(undefined), DEFAULT_PREFS);
});

test("saved choices are read back", () => {
  const p = parsePrefs(JSON.stringify({ density: "comfortable", columns: { phase: true, due: false } }));
  assert.equal(p.density, "comfortable");
  assert.equal(p.columns.phase, true);
  assert.equal(p.columns.due, false);
  assert.equal(p.columns.status, true);
});

test("damaged or unknown values fall back without throwing", () => {
  assert.deepEqual(parsePrefs("{not json"), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("42"), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("null"), DEFAULT_PREFS);
  const p = parsePrefs(JSON.stringify({ density: "huge", columns: { owner: "yes", extra: true, status: false } }));
  assert.equal(p.density, "compact");
  assert.equal(p.columns.owner, true);
  assert.equal(p.columns.status, false);
});

test("the defaults are never shared between callers", () => {
  const a = parsePrefs(null);
  a.columns.phase = true;
  assert.equal(parsePrefs(null).columns.phase, false);
  assert.equal(DEFAULT_PREFS.columns.phase, false);
});
