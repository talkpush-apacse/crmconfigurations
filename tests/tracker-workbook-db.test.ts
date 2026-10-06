import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

/**
 * The Excel download routes against a real database: who may download, what each copy contains, and that every
 * download is recorded for staff. Runs only against a LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost).
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-tracker-workbook-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

const SECRET_INTERNAL = "SECRET_INTERNAL_ITEM_TITLE";
const SECRET_BLOCKER = "SECRET_BLOCKER_REASON_TEXT";
const SECRET_EMAIL = "secret.person@example.invalid";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function sheetText(buf: ArrayBuffer): Promise<{ names: string[]; text: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: string[] = [];
  wb.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => out.push(String(cell.value ?? "")))));
  return { names: wb.worksheets.map((s) => s.name), text: out.join("\n") };
}

test("excel downloads", { skip }, async () => {
  const { NextRequest } = await import("next/server");
  const { createToken } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/db");
  const staffRoute = await import("../src/app/api/tracker/projects/[id]/export/workbook/route");
  const shareRoute = await import("../src/app/api/share/[token]/export/route");
  const contributeRoute = await import("../src/app/api/contribute/[token]/export/route");
  const itemRoute = await import("../src/app/api/contribute/[token]/items/[itemId]/route");
  const { resetShareLimiters } = await import("../src/lib/tracker/share-access");
  const { resetContributorLimiters } = await import("../src/lib/tracker/contributor-route");
  const { createViewerLink } = await import("../src/lib/tracker/share-service");
  const { issueContributorLink } = await import("../src/lib/tracker/contributor-service");
  const { CLIENT_LIMITS } = await import("../src/lib/tracker/contributor-validations");

  const suffix = Date.now().toString(36);
  const editor = await prisma.adminUser.create({ data: { email: `editor-${randomUUID()}@example.invalid`, role: "editor" }, select: { id: true, email: true } });
  const readOnly = await prisma.adminUser.create({ data: { email: `viewer-${randomUUID()}@example.invalid`, role: "viewer" }, select: { id: true } });
  const account = await prisma.trackerAccount.create({ data: { name: `Workbook test ${suffix}`, slug: `workbook-test-${suffix}` } });
  const ana = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Ana Reyes", email: SECRET_EMAIL } });
  const staffPerson = await prisma.trackerPerson.create({ data: { accountId: null, side: "talkpush", name: `Staff ${suffix}` } });
  const project = await prisma.trackerProject.create({
    data: {
      accountId: account.id,
      title: "Workbook test project",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      targetDate: new Date("2026-12-01T00:00:00.000Z"),
      phases: { create: [{ name: "Configuration", sortOrder: 0 }] },
    },
  });
  const mk = (title: string, data: Record<string, unknown> = {}) =>
    prisma.trackerItem.create({ data: { projectId: project.id, title, visibility: "client_visible", sortOrder: 0, ...data } as never });
  await mk(SECRET_INTERNAL, { visibility: "internal", ownerPersonId: staffPerson.id, status: "blocked", blockerReason: SECRET_BLOCKER, description: "SECRET_DESCRIPTION" });
  await mk("Talkpush builds the autoflows", { ownerPersonId: staffPerson.id, dueDate: new Date("2026-10-08T00:00:00.000Z") });
  const mine = await mk("Provide DNS records", { ownerPersonId: ana.id, dueDate: new Date("2026-10-01T00:00:00.000Z") });

  let ip = 0;
  const get = async (handler: (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>, url: string, params: Record<string, string>, opts: { cookie?: string; ip?: string } = {}) => {
    const headers: Record<string, string> = { "x-forwarded-for": opts.ip ?? `10.1.0.${++ip}` };
    if (opts.cookie) headers.cookie = opts.cookie;
    const res = await handler(new NextRequest(`http://localhost${url}`, { method: "GET", headers }), { params: Promise.resolve(params) });
    return { status: res.status, headers: res.headers, buf: await res.arrayBuffer() };
  };
  const json = (buf: ArrayBuffer) => JSON.parse(Buffer.from(buf).toString("utf8")) as Record<string, unknown>;
  const downloads = (actorLabel: string) => prisma.trackerActivity.count({ where: { projectId: project.id, action: "export.downloaded", actorLabel } });

  const editorCookie = `admin_token=${createToken(editor.id)}`;
  const readOnlyCookie = `admin_token=${createToken(readOnly.id)}`;

  try {
    // ---- staff: an editor and a read-only login can both download; nobody else can
    resetShareLimiters();
    resetContributorLimiters();
    const staffUrl = `/api/tracker/projects/${project.id}/export/workbook`;
    const sp = { id: project.id };
    assert.equal((await get(staffRoute.GET as never, staffUrl, sp)).status, 401, "a download needs a login");

    const asEditor = await get(staffRoute.GET as never, staffUrl, sp, { cookie: editorCookie });
    assert.equal(asEditor.status, 200);
    assert.equal(asEditor.headers.get("content-type"), XLSX);
    assert.match(asEditor.headers.get("content-disposition") ?? "", /attachment; filename="[A-Za-z0-9-]+-Tracker-\d{4}-\d{2}-\d{2}\.xlsx"/);
    const staffFile = await sheetText(asEditor.buf);
    assert.deepEqual(staffFile.names, ["Summary", "List", "Board", "Timeline"]);
    assert.ok(staffFile.text.includes(SECRET_INTERNAL), "the staff copy includes team-only items");
    assert.ok(staffFile.text.includes(SECRET_BLOCKER), "the staff copy includes blocker reasons");
    assert.equal(await downloads(editor.email), 1, "the staff download is recorded under the staff email");

    const asReadOnly = await get(staffRoute.GET as never, staffUrl, sp, { cookie: readOnlyCookie });
    assert.equal(asReadOnly.status, 200, "a read-only Talkpush login can download");

    // ---- view-only link: client-safe copy, recorded for staff
    const viewer = await createViewerLink(project.id, {}, { label: "test", via: "web" });
    const vt = { token: viewer.token };
    const asViewer = await get(shareRoute.GET as never, `/api/share/${viewer.token}/export`, vt);
    assert.equal(asViewer.status, 200);
    assert.equal(asViewer.headers.get("content-type"), XLSX);
    assert.equal(asViewer.headers.get("cache-control"), "no-store, max-age=0");
    const viewerFile = await sheetText(asViewer.buf);
    assert.deepEqual(viewerFile.names, ["Summary", "List", "Board", "Timeline"]);
    for (const secret of [SECRET_INTERNAL, SECRET_BLOCKER, SECRET_EMAIL, "SECRET_DESCRIPTION", editor.email]) {
      assert.ok(!viewerFile.text.includes(secret), `the client copy must not contain ${secret}`);
    }
    assert.ok(viewerFile.text.includes("Talkpush builds the autoflows"));
    const viewerLogged = await prisma.trackerActivity.findFirst({ where: { projectId: project.id, action: "export.downloaded", via: "client" } });
    assert.ok(viewerLogged, "the view-only download is recorded");
    assert.match(viewerLogged.actorLabel, /^Client link/);

    // bad links all look the same
    for (const token of ["nonsense", "tpv_" + "a".repeat(43)]) {
      const bad = await get(shareRoute.GET as never, `/api/share/${token}/export`, { token });
      assert.equal(bad.status, 404);
      assert.deepEqual(json(bad.buf), { error: "Not found" });
    }

    // ---- contributor link: client-safe copy, recorded under the contact's name
    const link = await issueContributorLink(project.id, { personId: ana.id, label: null, expiresAt: new Date(Date.now() + 86_400_000), assignUnassigned: false }, { label: "test", via: "web" });
    const ct = { token: link.token };
    const asContributor = await get(contributeRoute.GET as never, `/api/contribute/${link.token}/export`, ct);
    assert.equal(asContributor.status, 200);
    const contributorFile = await sheetText(asContributor.buf);
    for (const secret of [SECRET_INTERNAL, SECRET_BLOCKER, SECRET_EMAIL, "SECRET_DESCRIPTION"]) {
      assert.ok(!contributorFile.text.includes(secret), `the contributor copy must not contain ${secret}`);
    }
    assert.ok(contributorFile.text.includes("Provide DNS records"));
    assert.equal(await downloads("client:Ana Reyes"), 1);

    const crossed = await get(contributeRoute.GET as never, `/api/contribute/${viewer.token}/export`, vt);
    assert.equal(crossed.status, 404, "a view-only link must not open the contributor download");
    const crossed2 = await get(shareRoute.GET as never, `/api/share/${link.token}/export`, ct);
    assert.equal(crossed2.status, 404, "a contributor link must not open the view-only download");

    // ---- downloads do not use up a contact's daily allowance for real changes
    await prisma.trackerActivity.createMany({
      data: Array.from({ length: CLIENT_LIMITS.changesPerDay - 1 }, () => ({
        projectId: project.id,
        entityType: "item",
        entityId: mine.id,
        action: "item.updated",
        actorLabel: "client:Ana Reyes",
        via: "client",
      })),
    });
    await get(contributeRoute.GET as never, `/api/contribute/${link.token}/export`, ct);
    await get(contributeRoute.GET as never, `/api/contribute/${link.token}/export`, ct);
    const patch = async (status: string) => {
      const res = await (itemRoute.PATCH as never as (r: unknown, c: unknown) => Promise<Response>)(
        new NextRequest(`http://localhost/api/contribute/${link.token}/items/${mine.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${++ip}` },
          body: JSON.stringify({ status }),
        }),
        { params: Promise.resolve({ token: link.token, itemId: mine.id }) }
      );
      return res.status;
    };
    assert.equal(await patch("in_progress"), 200, "three downloads did not count as changes");
    assert.equal(await patch("done"), 429, "the 100th real change is over the limit");

    // ---- downloads are capped per address
    resetShareLimiters();
    const same = "10.9.9.9";
    for (let n = 0; n < 10; n++) assert.equal((await get(shareRoute.GET as never, `/api/share/${viewer.token}/export`, vt, { ip: same })).status, 200);
    const tooMany = await get(shareRoute.GET as never, `/api/share/${viewer.token}/export`, vt, { ip: same });
    assert.equal(tooMany.status, 429);
    assert.equal(tooMany.headers.get("retry-after"), "300");
  } finally {
    await prisma.trackerProject.delete({ where: { id: project.id } }).catch(() => undefined);
    await prisma.trackerPerson.deleteMany({ where: { id: { in: [ana.id, staffPerson.id] } } }).catch(() => undefined);
    await prisma.trackerAccount.delete({ where: { id: account.id } }).catch(() => undefined);
    await prisma.adminUser.deleteMany({ where: { id: { in: [editor.id, readOnly.id] } } }).catch(() => undefined);
  }
});
