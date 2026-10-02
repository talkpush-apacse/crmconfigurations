/**
 * End-to-end check of the PUBLIC client link, over real HTTP, against a local server.
 *
 *   DATABASE_URL_DIRECT=postgresql://you@localhost:54329/tracker_dev npx tsx scripts/check-share-route.ts http://localhost:3100
 *
 * Refuses to run unless both the database and the server are on localhost.
 * Creates (then revokes) links on the first project it finds.
 */
import "dotenv/config";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";
const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};
if (!LOCAL.includes(hostOf(dbUrl)) || !LOCAL.includes(hostOf(base))) {
  console.error("Refusing to run: both the database and the server must be on localhost.");
  process.exit(1);
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { createViewerLink, revokeShareLink } = await import("../src/lib/tracker/share-service");
  const actor = { label: "share-route-check", via: "web" as const };
  let failures = 0;
  const check = (label: string, pass: boolean, detail = "") => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
    if (!pass) failures++;
  };

  // Prefer the seeded demo project; otherwise any project that has a team-only item.
  const project =
    (await prisma.trackerProject.findFirst({ where: { archived: false, account: { slug: "demo-northwind-traders" } }, select: { id: true } })) ??
    (await prisma.trackerProject.findFirst({ where: { archived: false, items: { some: { visibility: "internal" } } }, select: { id: true } }));
  if (!project) throw new Error("Need a project with at least one internal item (run scripts/seed-tracker-demo.ts).");

  const internalItems = await prisma.trackerItem.findMany({ where: { projectId: project.id, visibility: "internal" }, select: { title: true } });
  const blockers = await prisma.trackerItem.findMany({ where: { projectId: project.id, blockerReason: { not: null } }, select: { blockerReason: true } });
  const internalRemarks = await prisma.trackerRemark.findMany({ where: { item: { projectId: project.id }, visibility: "internal" }, select: { body: true } });
  const internalMetrics = await prisma.trackerMetric.findMany({ where: { projectId: project.id, visibility: "internal" }, select: { name: true } });
  // A string that is ALSO legitimately visible to clients (a phase name, a client-visible item title) cannot prove a leak.
  const visibleStrings = new Set([
    ...(await prisma.trackerPhase.findMany({ where: { projectId: project.id }, select: { name: true } })).map((p) => p.name),
    ...(await prisma.trackerItem.findMany({ where: { projectId: project.id, visibility: "client_visible", archived: false }, select: { title: true } })).map((i) => i.title),
  ]);
  const secrets = [
    ...internalItems.map((i) => i.title).filter((t) => !visibleStrings.has(t)),
    ...blockers.map((b) => b.blockerReason as string),
    ...internalRemarks.map((r) => r.body),
    ...internalMetrics.map((m) => m.name),
    "@talkpush.com",
    "Claude (MCP)",
  ];

  const link = await createViewerLink(project.id, { label: "route check" }, actor);
  const url = `${base}/api/share/${link.token}`;

  const ok = await fetch(url);
  const text = await ok.text();
  check("a valid link returns 200", ok.status === 200, `HTTP ${ok.status}`);
  check("response is never cached", (ok.headers.get("cache-control") ?? "").includes("no-store"));
  check("response is not indexed", (ok.headers.get("x-robots-tag") ?? "").includes("noindex"));
  check("response sends no referrer", ok.headers.get("referrer-policy") === "no-referrer");
  check("no cookies are set", !ok.headers.get("set-cookie"));
  const leaked = secrets.filter((s) => s && text.includes(s));
  check(`none of ${secrets.length} internal strings appear in the response`, leaked.length === 0, leaked.join(", "));

  const bad = await fetch(`${base}/api/share/${link.token}x`);
  const badBody = await bad.text();
  check("a wrong token gets a generic 404", bad.status === 404 && JSON.parse(badBody).error === "Not found");

  const post = await fetch(url, { method: "POST" });
  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" });
  const del = await fetch(url, { method: "DELETE" });
  check("it is read-only: POST, PUT and DELETE are refused", [post.status, put.status, del.status].every((s) => s === 405), `${post.status}/${put.status}/${del.status}`);

  const page = await fetch(`${base}/share/${link.token}`);
  const html = await page.text();
  check("the public page loads", page.status === 200);
  check("the page tells search engines not to index it", /name="robots"[^>]*noindex|noindex[^>]*name="robots"/.test(html));
  check("the page sets a no-referrer policy", /name="referrer"[^>]*no-referrer|no-referrer[^>]*name="referrer"/.test(html));
  check("the page itself carries no project data", !secrets.some((s) => s && html.includes(s)));

  const staffOnly = await fetch(`${base}/api/tracker/projects/${project.id}/client-view`);
  check("the staff preview route still needs a login", staffOnly.status === 401, `HTTP ${staffOnly.status}`);
  const shareList = await fetch(`${base}/api/tracker/projects/${project.id}/share-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("creating links still needs a login", shareList.status === 401, `HTTP ${shareList.status}`);

  await revokeShareLink(link.id, actor);
  const revoked = await fetch(url);
  const revokedBody = await revoked.text();
  check("a revoked link gets the SAME generic 404 as a wrong one", revoked.status === 404 && revokedBody === badBody);

  // Rate limiting: hammer unknown tokens until the failed-attempt cap trips.
  let limited = 0;
  for (let i = 0; i < 25 && !limited; i++) {
    const r = await fetch(`${base}/api/share/tpv_${"z".repeat(43)}${i}`, { headers: { "x-forwarded-for": "203.0.113.77" } });
    if (r.status === 429) limited = i + 1;
  }
  check("repeated bad guesses from one address are rate limited", limited > 0, limited ? `blocked after ${limited} tries` : "never blocked");

  await prisma.$disconnect();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
