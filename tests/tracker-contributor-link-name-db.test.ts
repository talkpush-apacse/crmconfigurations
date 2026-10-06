import test from "node:test";
import assert from "node:assert/strict";

/**
 * Creating a Client Contributor link for a typed name: reuse the matching contact, otherwise make a new one.
 * Runs only against a LOCAL database (TRACKER_TEST_DATABASE_URL pointing at localhost); skipped otherwise.
 */

const testDb = process.env.TRACKER_TEST_DATABASE_URL ?? "";
const isLocalDb = /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(testDb);
if (isLocalDb) {
  process.env.DATABASE_URL_DIRECT = testDb;
  process.env.ADMIN_SECRET = "test-only-secret-for-link-name-tests-0123456789";
}
const skip = !isLocalDb && "set TRACKER_TEST_DATABASE_URL to a localhost database";

test("a contributor link for a typed name", { skip }, async () => {
  const { prisma } = await import("../src/lib/db");
  const { createContributorLink, resolveContributorToken } = await import("../src/lib/tracker/contributor-service");
  const actor = { label: "staff@example.invalid", via: "web" as const };

  const suffix = Date.now().toString(36);
  const account = await prisma.trackerAccount.create({ data: { name: `Link name test ${suffix}`, slug: `link-name-${suffix}` } });
  const other = await prisma.trackerAccount.create({ data: { name: `Other ${suffix}`, slug: `link-name-other-${suffix}` } });
  const brian = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Brian Sunga", email: "brian@example.invalid" } });
  const twin1 = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Sam Twin" } });
  const twin2 = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Sam Twin", email: "sam2@example.invalid" } });
  const archived = await prisma.trackerPerson.create({ data: { accountId: account.id, side: "client", name: "Old Contact", archived: true } });
  const strangerSameName = await prisma.trackerPerson.create({ data: { accountId: other.id, side: "client", name: "Bruce Dela Rosa" } });
  const staff = await prisma.trackerPerson.create({ data: { accountId: null, side: "talkpush", name: `Staff ${suffix}` } });
  const project = await prisma.trackerProject.create({ data: { accountId: account.id, title: "Link name project" } });
  const archivedProject = await prisma.trackerProject.create({ data: { accountId: account.id, title: "Archived one", archived: true } });
  const contacts = () => prisma.trackerPerson.findMany({ where: { accountId: account.id, side: "client" }, select: { id: true, name: true, email: true, archived: true } });

  try {
    // an existing contact is used, however it is typed, and nothing is duplicated
    const before = (await contacts()).length;
    const a = await createContributorLink(project.id, { name: "  brian   SUNGA " }, actor);
    assert.equal(a.contact, "Brian Sunga");
    assert.equal(a.contactCreated, false);
    assert.equal((await contacts()).length, before, "no duplicate contact");
    assert.equal((await resolveContributorToken(a.token))?.person.id, brian.id);

    // by email, whatever name is typed
    const b = await createContributorLink(project.id, { name: "B. Sunga", email: "Brian@Example.invalid" }, actor);
    assert.equal(b.contact, "Brian Sunga");
    assert.equal(b.contactCreated, false);

    // a new name makes a new client contact on THIS account, with the email kept
    const c = await createContributorLink(project.id, { name: "Bruce  Dela Rosa", email: "Bruce@Example.invalid" }, actor);
    assert.equal(c.contact, "Bruce Dela Rosa");
    assert.equal(c.contactCreated, true);
    const made = await prisma.trackerPerson.findFirst({ where: { accountId: account.id, name: "Bruce Dela Rosa" } });
    assert.equal(made!.side, "client");
    assert.equal(made!.email, "bruce@example.invalid");
    assert.equal((await resolveContributorToken(c.token))?.person.id, made!.id);
    assert.notEqual(made!.id, strangerSameName.id, "a contact with the same name on another account is never reused");
    const log = await prisma.trackerActivity.findFirst({ where: { projectId: project.id, action: "share.contributor_created", after: { path: ["contactCreated"], equals: true } } });
    assert.ok(log, "the log says a new contact was made");

    // typing the same new name again reuses the contact just made
    const again = await createContributorLink(project.id, { name: "bruce dela rosa" }, actor);
    assert.equal(again.contactCreated, false);
    assert.equal((await contacts()).filter((p) => p.name === "Bruce Dela Rosa").length, 1);

    // two contacts with one name: pick by email, otherwise ask
    await assert.rejects(createContributorLink(project.id, { name: "Sam Twin" }, actor), /More than one contact/);
    const sam = await createContributorLink(project.id, { name: "Sam Twin", email: "sam2@example.invalid" }, actor);
    assert.equal((await resolveContributorToken(sam.token))?.person.id, twin2.id);
    void twin1;

    // an archived contact is not brought back; a fresh one is made
    const old = await createContributorLink(project.id, { name: "Old Contact" }, actor);
    assert.equal(old.contactCreated, true);
    assert.notEqual((await resolveContributorToken(old.token))?.person.id, archived.id);

    // a person on the Talkpush side, an unknown id, and an archived project are all refused
    await assert.rejects(createContributorLink(project.id, { personId: staff.id }, actor), /client contact/);
    await assert.rejects(createContributorLink(project.id, { personId: "nope" }, actor), /not found|Contact/i);
    await assert.rejects(createContributorLink(archivedProject.id, { name: "Someone New" }, actor), /archived/);
    assert.equal((await contacts()).some((p) => p.name === "Someone New"), false, "nothing was made for an archived project");

    // the old way, picking an existing contact, still works
    const old2 = await createContributorLink(project.id, { personId: brian.id }, actor);
    assert.equal(old2.contact, "Brian Sunga");
    assert.equal(old2.contactCreated, false);

    // bad input
    await assert.rejects(createContributorLink(project.id, {}, actor));
    await assert.rejects(createContributorLink(project.id, { name: "Zed", email: "nope" }, actor));
  } finally {
    await prisma.trackerProject.deleteMany({ where: { id: { in: [project.id, archivedProject.id] } } }).catch(() => undefined);
    await prisma.trackerPerson.deleteMany({ where: { accountId: { in: [account.id, other.id] } } }).catch(() => undefined);
    await prisma.trackerPerson.deleteMany({ where: { id: staff.id } }).catch(() => undefined);
    await prisma.trackerAccount.deleteMany({ where: { id: { in: [account.id, other.id] } } }).catch(() => undefined);
  }
});
