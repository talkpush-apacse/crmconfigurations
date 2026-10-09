import test from "node:test";
import assert from "node:assert/strict";
import { parseSlotDate, previousSlot, scheduledSlotFor, sinceWord, slotToString, windowFor } from "../src/lib/activity-digest/window";

const iso = (d: Date) => d.toISOString();

test("8:00 am Manila is 00:00 UTC the same day, so a Tuesday digest covers Monday 8:00 am to Tuesday 8:00 am", () => {
  const w = windowFor(parseSlotDate("2026-10-06")); // Tuesday
  assert.equal(iso(w.start), "2026-10-05T00:00:00.000Z");
  assert.equal(iso(w.end), "2026-10-06T00:00:00.000Z");
  assert.equal(sinceWord(parseSlotDate("2026-10-06")), "yesterday");
});

test("a Monday digest looks back over the weekend to Friday 8:00 am", () => {
  const slot = parseSlotDate("2026-10-05"); // Monday
  const w = windowFor(slot);
  assert.equal(iso(w.start), "2026-10-02T00:00:00.000Z");
  assert.equal(iso(w.end), "2026-10-05T00:00:00.000Z");
  assert.equal(sinceWord(slot), "Friday");
});

test("the window crosses a month and a year boundary correctly", () => {
  assert.equal(slotToString(previousSlot(parseSlotDate("2026-11-02"))), "2026-10-30"); // Mon 2 Nov -> Fri 30 Oct
  assert.equal(slotToString(previousSlot(parseSlotDate("2027-01-04"))), "2027-01-01"); // Mon 4 Jan -> Fri 1 Jan
  assert.equal(slotToString(previousSlot(parseSlotDate("2026-03-02"))), "2026-02-27");
});

test("a run that starts late still delivers its own scheduled slot (Hobby plan can start up to an hour late)", () => {
  // Wednesday 2026-10-07 at 08:40 Manila = 00:40 UTC
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-07T00:40:00Z"))), "2026-10-07");
  // exactly on time
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-07T00:00:00Z"))), "2026-10-07");
});

test("a run before 8:00 am Manila belongs to the previous weekday's slot", () => {
  // Wednesday 07:59 Manila = Tuesday 23:59 UTC
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-06T23:59:00Z"))), "2026-10-06");
});

test("a Manila date that is a different UTC date is handled (Tuesday 06:00 Manila is still Monday in UTC)", () => {
  // Tue 2026-10-06 06:00 Manila = Mon 2026-10-05 22:00 UTC; slot not reached yet -> Monday's slot
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-05T22:00:00Z"))), "2026-10-05");
});

test("a manual run on a weekend delivers Friday's slot", () => {
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-04T10:00:00Z"))), "2026-10-02"); // Sunday
  assert.equal(slotToString(scheduledSlotFor(new Date("2026-10-03T10:00:00Z"))), "2026-10-02"); // Saturday
});

test("a bad or weekend date is refused in plain words", () => {
  assert.throws(() => parseSlotDate("10/06/2026"), /Use a date like/);
  assert.throws(() => parseSlotDate("2026-02-30"), /does not exist/);
  assert.throws(() => parseSlotDate("2026-10-03"), /Monday to Friday/); // Saturday
});

test("consecutive windows join up with no gap and no overlap, across a whole week", () => {
  const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"];
  for (let i = 1; i < days.length; i++) {
    assert.equal(iso(windowFor(parseSlotDate(days[i])).start), iso(windowFor(parseSlotDate(days[i - 1])).end), days[i]);
  }
});
