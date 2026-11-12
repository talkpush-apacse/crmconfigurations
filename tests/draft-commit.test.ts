import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_COMMIT_DELAY_MS,
  DraftCommitter,
  cancelAllDrafts,
  flushAllDrafts,
  hasPendingDrafts,
  subscribeDrafts,
} from "../src/lib/draft-commit";

const D = DRAFT_COMMIT_DELAY_MS;

function recorder() {
  const calls: string[] = [];
  return { calls, commit: (value: string) => calls.push(value) };
}

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout"] });
});

afterEach(() => {
  cancelAllDrafts();
  mock.timers.reset();
});

test("hands over the last text once, after the pause", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.type("a");
  c.type("ab");
  c.type("abc");
  mock.timers.tick(D - 1);
  assert.deepEqual(r.calls, []);
  mock.timers.tick(1);
  assert.deepEqual(r.calls, ["abc"]);
  mock.timers.tick(D * 5);
  assert.deepEqual(r.calls, ["abc"], "a finished draft is not handed over again");
});

test("every keystroke restarts the pause", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.type("a");
  mock.timers.tick(D - 50);
  c.type("ab");
  mock.timers.tick(D - 50);
  assert.deepEqual(r.calls, [], "still typing, so nothing yet");
  mock.timers.tick(50);
  assert.deepEqual(r.calls, ["ab"]);
});

test("cancel (Escape, paste, moving cell) means a running timer can never write the old draft", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.type("old draft");
  c.cancel();
  mock.timers.tick(D * 3);
  assert.deepEqual(r.calls, []);
  assert.equal(c.hasPending, false);
  assert.equal(hasPendingDrafts(), false);
});

test("flush hands over immediately and leaves no timer behind", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.type("typed");
  c.flush();
  assert.deepEqual(r.calls, ["typed"]);
  mock.timers.tick(D * 3);
  assert.deepEqual(r.calls, ["typed"], "the old timer must not hand it over a second time");
});

test("flush with nothing pending does nothing", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.flush();
  assert.deepEqual(r.calls, []);
});

test("typing again after a handover starts a fresh draft", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.type("one");
  mock.timers.tick(D);
  c.type("one two");
  mock.timers.tick(D);
  assert.deepEqual(r.calls, ["one", "one two"]);
});

test("IME composition is not saved half-composed, but leaving still saves it", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  c.compositionStart();
  c.type("ni");
  mock.timers.tick(D * 3);
  assert.deepEqual(r.calls, [], "timer stays off while composing");
  c.compositionEnd();
  mock.timers.tick(D);
  assert.deepEqual(r.calls, ["ni"]);

  const r2 = recorder();
  const c2 = new DraftCommitter({ commit: r2.commit });
  c2.compositionStart();
  c2.type("half-word");
  c2.flush();
  assert.deepEqual(r2.calls, ["half-word"], "leaving the page mid-composition keeps what was typed");
});

test("the registry knows what is still being typed, and flushAll / cancelAll act on all of it", () => {
  const a = recorder();
  const b = recorder();
  const ca = new DraftCommitter({ commit: a.commit });
  const cb = new DraftCommitter({ commit: b.commit });
  assert.equal(hasPendingDrafts(), false);

  ca.type("A");
  cb.type("B");
  assert.equal(hasPendingDrafts(), true);
  flushAllDrafts();
  assert.deepEqual(a.calls, ["A"]);
  assert.deepEqual(b.calls, ["B"]);
  assert.equal(hasPendingDrafts(), false);

  ca.type("A2");
  cb.type("B2");
  cancelAllDrafts();
  mock.timers.tick(D * 3);
  assert.deepEqual(a.calls, ["A"]);
  assert.deepEqual(b.calls, ["B"]);
  assert.equal(hasPendingDrafts(), false);
});

test("subscribers hear about each change in what is pending, and can stop listening", () => {
  const r = recorder();
  const c = new DraftCommitter({ commit: r.commit });
  let heard = 0;
  const stop = subscribeDrafts(() => heard++);

  c.type("a"); // became pending
  c.type("ab"); // still pending: no news
  assert.equal(heard, 1);
  c.flush(); // no longer pending
  assert.equal(heard, 2);
  c.type("x");
  c.cancel();
  assert.equal(heard, 4);

  stop();
  c.type("y");
  c.cancel();
  assert.equal(heard, 4, "no more notifications after unsubscribing");
});

test("a commit that throws still leaves the committer and registry clean", () => {
  const c = new DraftCommitter({
    commit: () => {
      throw new Error("boom");
    },
  });
  c.type("x");
  assert.throws(() => c.flush(), /boom/);
  assert.equal(c.hasPending, false);
  assert.equal(hasPendingDrafts(), false);
});

test("a pause that was started earlier hands the text to the newest receiver, not the one from when typing began", () => {
  const first = recorder();
  const second = recorder();
  const c = new DraftCommitter({ commit: first.commit });
  c.type("typed");
  c.setCommit(second.commit); // the page re-rendered while the timer was running
  mock.timers.tick(D);
  assert.deepEqual(first.calls, []);
  assert.deepEqual(second.calls, ["typed"]);
});
