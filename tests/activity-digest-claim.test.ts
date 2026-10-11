import test from "node:test";
import assert from "node:assert/strict";
import { STALE_AFTER_MS, decideClaim } from "../src/lib/activity-digest/claim-rules";
import { MAX_CATCH_UP_DAYS, isCatchUp, parseSlotDate, sinceLabel, windowStartFor } from "../src/lib/activity-digest/window";

const NOW = new Date("2026-10-08T00:10:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

test("a slot that was already sent or skipped is a duplicate; a person can force a re-send", () => {
  for (const status of ["sent", "skipped"]) {
    assert.equal(decideClaim({ status, startedAt: ago(60_000) }, NOW, false), "already_done");
    assert.equal(decideClaim({ status, startedAt: ago(60_000) }, NOW, true), "takeover");
  }
});

test("a failed slot is taken over and tried again", () => {
  assert.equal(decideClaim({ status: "failed", startedAt: ago(5_000) }, NOW, false), "takeover");
});

test("a slot another run is working on is left alone, unless that run has been stuck for 30 minutes", () => {
  assert.equal(decideClaim({ status: "sending", startedAt: ago(60_000) }, NOW, false), "in_progress");
  assert.equal(decideClaim({ status: "sending", startedAt: ago(STALE_AFTER_MS - 1) }, NOW, false), "in_progress");
  assert.equal(decideClaim({ status: "sending", startedAt: ago(STALE_AFTER_MS) }, NOW, false), "takeover");
  // forcing never barges in on a live run
  assert.equal(decideClaim({ status: "sending", startedAt: ago(60_000) }, NOW, true), "in_progress");
});

test("a status this code does not know is never acted on", () => {
  assert.equal(decideClaim({ status: "banana", startedAt: ago(10 * STALE_AFTER_MS) }, NOW, true), "in_progress");
});

const iso = (d: Date) => d.toISOString();

test("normal day: the window starts at the previous weekday's 8:00 am, with or without a record", () => {
  const tue = parseSlotDate("2026-10-06");
  assert.equal(iso(windowStartFor(tue, null)), "2026-10-05T00:00:00.000Z");
  assert.equal(iso(windowStartFor(tue, new Date("2026-10-05T00:00:00Z"))), "2026-10-05T00:00:00.000Z");
  assert.equal(iso(windowStartFor(parseSlotDate("2026-10-05"), new Date("2026-10-02T00:00:00Z"))), "2026-10-02T00:00:00.000Z"); // Monday after Friday
});

test("a missed day is caught up: the window starts where the last completed digest ended", () => {
  // Thursday's digest runs; the last one that went out was Tuesday's (ended Tue 8 am); Wednesday was missed.
  const thu = parseSlotDate("2026-10-08");
  const start = windowStartFor(thu, new Date("2026-10-06T00:00:00Z"));
  assert.equal(iso(start), "2026-10-06T00:00:00.000Z");
  assert.equal(isCatchUp(thu, start), true);
  assert.equal(sinceLabel(thu, start), "Tuesday");
});

test("a long gap is capped at 7 days and labelled with a date", () => {
  const slot = parseSlotDate("2026-10-19"); // Monday
  const start = windowStartFor(slot, new Date("2026-09-01T00:00:00Z"));
  assert.equal(iso(start), "2026-10-12T00:00:00.000Z");
  assert.equal(MAX_CATCH_UP_DAYS, 7);
  assert.equal(sinceLabel(slot, start), "12 Oct");
});

test("normal windows keep the existing wording", () => {
  const tue = parseSlotDate("2026-10-06"), mon = parseSlotDate("2026-10-05");
  assert.equal(sinceLabel(tue, windowStartFor(tue, null)), "yesterday");
  assert.equal(sinceLabel(mon, windowStartFor(mon, null)), "Friday");
  assert.equal(isCatchUp(tue, windowStartFor(tue, null)), false);
});
