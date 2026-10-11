import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

/**
 * The digest's send record, end to end against a real database: the first run sends, a duplicate stops, only one of two
 * simultaneous runs sends, a failed send is retried, a stuck run is taken over, a missed day is caught up, a quiet day is
 * recorded as skipped, a forced re-send works, and a dry run records nothing. The real route runs; only the email service
 * is stubbed, so nothing is sent. Runs only against a LOCAL database (WORKFLOW_TEST_DATABASE_URL pointing at localhost).
 */

const testDb = process.env.WORKFLOW_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-digest-run-tests-0123456789";
  // The email module guards itself with `server-only`, which refuses to load outside a Next.js build. Not needed here.
  const req = Module.createRequire(__filename);
  const resolved = req.resolve("server-only");
  req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {} } as never;
}
const skip = !isLocalDb && "set WORKFLOW_TEST_DATABASE_URL to a localhost database";

const SECRET = "digest-run-test-secret-0123456789abcdef";
const RECIPIENT = "digest-run-test@example.invalid";
const SLUG = "digest-run-test-checklist";
const at = (iso: string) => new Date(iso);
// Slots in 2030 so they can never collide with real or seeded data. 2030-03-05 is a Tuesday.
const TUE = "2030-03-05", WED = "2030-03-06", THU = "2030-03-07", FRI = "2030-03-08", MON = "2030-03-11", TUE2 = "2030-03-12";

test("digest send record", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { prisma } = await import("../src/lib/db");
  const p = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { GET } = await import("../src/app/api/cron/activity-digest/route");

  process.env.CRON_SECRET = SECRET;
  process.env.ACTIVITY_DIGEST_TO = RECIPIENT;
  process.env.APP_BASE_URL = "http://localhost:3030";
  process.env.BREVO_API_KEY = "fake-key";
  process.env.NOTIFICATION_FROM_EMAIL = "Hub <updates@example.com>";

  const realFetch = globalThis.fetch;
  let sends: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let brevoStatus = 201;
  globalThis.fetch = (async (url: any, init: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    sends.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("{}", { status: brevoStatus });
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const run = async (qs: string) => {
    const res = await GET(new NextRequest(`http://localhost/api/cron/activity-digest?${qs}`, { headers: { authorization: `Bearer ${SECRET}` } }));
    return { status: res.status, body: (await res.json()) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const rowFor = (day: string) => p.activityDigestRun.findUnique({ where: { windowEnd: at(`${day}T00:00:00Z`) } });

  const cleanup = async () => {
    await p.activityDigestRun.deleteMany({ where: { windowEnd: { gte: at("2030-01-01T00:00:00Z"), lt: at("2031-01-01T00:00:00Z") } } });
    await p.checklist.deleteMany({ where: { slug: SLUG } });
    await p.adminUser.deleteMany({ where: { email: RECIPIENT } });
  };
  await cleanup();

  try {
    await p.adminUser.create({ data: { email: RECIPIENT, role: "editor", isSuperAdmin: true } });
    const cl = await p.checklist.create({ data: { slug: SLUG, clientName: "Digest run test" } });
    const event = (id: string, when: string) =>
      p.checklistEditEvent.create({
        data: { id, checklistId: cl.id, actorType: "admin", actorName: "roy.santos@talkpush.com", tabKey: "sites", tabLabel: "Sites", changeType: "added", summary: `Added "Site ${id}"`, checklistVersion: 1, coalesceKey: id, createdAt: at(when), updatedAt: at(when) },
      });
    // Changes inside Tue's window (Mon 8 am to Tue 8 am Manila), Thu's, Fri's, and between Tue and Thu (for the catch-up).
    await event("digest-run-e1", "2030-03-04T05:00:00Z");
    await event("digest-run-e2", "2030-03-05T12:00:00Z"); // Wed's window: never delivered on its own, caught up by Thursday
    await event("digest-run-e3", "2030-03-06T05:00:00Z"); // Thursday's window
    await event("digest-run-e4", "2030-03-07T05:00:00Z"); // Friday's window
    await event("digest-run-e5", "2030-03-11T05:00:00Z"); // Tuesday 12th's window
    await event("digest-run-e6", "2030-03-09T05:00:00Z"); // Monday 11th's window (the weekend)

    // 1. A dry run records nothing and sends nothing.
    sends = [];
    let r = await run(`date=${TUE}&dryRun=1`);
    assert.equal(r.status, 200);
    assert.equal(r.body.dryRun, true, JSON.stringify(r.body).slice(0, 300));
    assert.equal(sends.length, 0);
    assert.equal(await rowFor(TUE), null, "a dry run must not create a record");

    // 2. The first real run sends once and records it as sent.
    r = await run(`date=${TUE}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.sent, true);
    assert.equal(r.body.runRecorded, true);
    assert.equal(sends.length, 1);
    assert.deepEqual(sends[0].body.to, [{ email: RECIPIENT }]);
    let row = await rowFor(TUE);
    assert.equal(row.status, "sent");
    assert.equal(row.changeCount, r.body.changes);
    assert.ok(row.finishedAt);

    // 3. A duplicate run for the same slot stops. No second email.
    r = await run(`date=${TUE}`);
    assert.equal(r.body.sent, false);
    assert.match(r.body.reason, /Already sent/);
    assert.equal(sends.length, 1, "no second email");

    // 4. Two runs at the same instant: exactly one sends.
    sends = [];
    const [a, b] = await Promise.all([run(`date=${FRI}`), run(`date=${FRI}`)]);
    assert.equal(sends.length, 1, "exactly one email from two simultaneous runs");
    assert.equal([a, b].filter((x) => x.body.sent === true).length, 1);
    assert.equal((await rowFor(FRI)).status, "sent");

    // 5. Catch-up: Wednesday's digest never ran; Thursday's starts where Tuesday's ended and includes Wednesday's change.
    sends = [];
    r = await run(`date=${THU}`);
    assert.equal(r.body.sent, true);
    assert.equal(r.body.windowStart, "2030-03-05T00:00:00.000Z", "starts at the end of the last completed digest");
    assert.match(sends[0].body.subject, /since Tuesday/);
    assert.match(sends[0].body.textContent, /No digest went out on some earlier days/);
    assert.match(sends[0].body.textContent, /Site digest-run-e2/, "the change from the missed day is included");
    assert.match(sends[0].body.textContent, /Site digest-run-e3/);

    // 6. A failed send is recorded as failed, and the next run takes the slot over and sends.
    sends = [];
    brevoStatus = 401;
    r = await run(`date=${MON}`);
    assert.equal(r.status, 502);
    assert.equal((await rowFor(MON)).status, "failed");
    brevoStatus = 201;
    r = await run(`date=${MON}`);
    assert.equal(r.body.sent, true);
    row = await rowFor(MON);
    assert.equal(row.status, "sent");
    assert.equal(sends.length, 2, "the failed attempt and the retry");

    // 7. A run that crashed (stuck on 'sending' for over 30 minutes) is taken over; a fresh one is left alone.
    sends = [];
    await p.activityDigestRun.create({ data: { windowStart: at("2030-03-11T00:00:00Z"), windowEnd: at(`${TUE2}T00:00:00Z`), status: "sending", startedAt: new Date(Date.now() - 5 * 60 * 1000) } });
    r = await run(`date=${TUE2}`);
    assert.match(r.body.reason, /Another run is working/);
    assert.equal(sends.length, 0);
    await p.activityDigestRun.update({ where: { windowEnd: at(`${TUE2}T00:00:00Z`) }, data: { startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    r = await run(`date=${TUE2}`);
    assert.equal(r.body.sent, true, "the stuck run is taken over");
    assert.equal((await rowFor(TUE2)).status, "sent");

    // 8. A quiet day (after a completed day, so nothing is being caught up) sends nothing and is recorded as skipped.
    sends = [];
    r = await run(`date=${WED.replace("03-06", "03-13")}`); // Wed 2030-03-13, no changes
    assert.equal(r.body.sent, false);
    assert.equal(r.body.reason, "no changes");
    assert.equal(sends.length, 0);
    row = await rowFor("2030-03-13");
    assert.equal(row.status, "skipped");
    assert.equal(row.reason, "no changes");

    // 9. A person can force a re-send of a slot that was already sent.
    sends = [];
    r = await run(`date=${TUE}&force=1`);
    assert.equal(r.body.sent, true);
    assert.equal(sends.length, 1);
    r = await run(`date=${TUE}`);
    assert.match(r.body.reason, /Already sent/);

    // 10. The record holds no personal data or change text.
    const all = await p.activityDigestRun.findMany({ where: { windowEnd: { gte: at("2030-01-01T00:00:00Z"), lt: at("2031-01-01T00:00:00Z") } } });
    const dump = JSON.stringify(all);
    assert.doesNotMatch(dump, /@|Site digest|roy\.santos|Digest run test/);
  } finally {
    globalThis.fetch = realFetch;
    await cleanup();
    await p.$disconnect?.();
  }
});
