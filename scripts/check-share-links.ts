/**
 * Exercises the client share-link service against the local database:
 * create, resolve, wrong token, expiry, revoke, and that only a hash is stored.
 *
 *   DATABASE_URL_DIRECT=postgresql://you@localhost:54329/tracker_dev npx tsx scripts/check-share-links.ts
 *
 * Refuses to run unless the database host is localhost. Uses the first
 * non-archived project it finds and leaves one revoked "Check link" behind.
 */
import "dotenv/config";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  /* handled below */
}
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Refusing to run: database host "${host || "unknown"}" is not localhost.`);
  process.exit(1);
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { createViewerLink, listShareLinks, resolveViewerToken, revokeShareLink } = await import("../src/lib/tracker/share-service");
  const actor = { label: "share-check", via: "web" as const };
  let failures = 0;
  const check = (label: string, pass: boolean) => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) failures++;
  };

  const project = await prisma.trackerProject.findFirst({ where: { archived: false }, select: { id: true } });
  if (!project) throw new Error("No project found. Run scripts/seed-tracker-demo.ts first.");
  const PID = project.id;

  const link = await createViewerLink(PID, { label: "Check link", expiresInDays: 30 }, actor);
  check("create returns the secret token once", typeof link.token === "string" && link.token.startsWith("tpv_"));
  const row = await prisma.trackerShareLink.findUnique({ where: { id: link.id } });
  check("the database stores only a hash, not the token", !!row && row.tokenHash !== link.token && !JSON.stringify(row).includes(link.token));
  check("a valid token resolves to the project", (await resolveViewerToken(link.token)) === PID);
  check("a wrong token resolves to nothing", (await resolveViewerToken(link.token + "x")) === null);
  check("garbage resolves to nothing", (await resolveViewerToken("hello")) === null);
  const listed = JSON.stringify(await listShareLinks(PID));
  check("the list never exposes the token or its hash", !listed.includes(link.token) && !listed.includes(row!.tokenHash));
  await prisma.trackerShareLink.update({ where: { id: link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("an expired link stops working", (await resolveViewerToken(link.token)) === null);
  await prisma.trackerShareLink.update({ where: { id: link.id }, data: { expiresAt: null } });
  check("it works again when the expiry is cleared", (await resolveViewerToken(link.token)) === PID);
  await revokeShareLink(link.id, actor);
  check("a revoked link stops working", (await resolveViewerToken(link.token)) === null);

  await prisma.$disconnect();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
