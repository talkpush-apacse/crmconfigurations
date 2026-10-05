/**
 * Seeds ONE clearly fake demo project for the Project Tracker.
 *
 *   DATABASE_URL_DIRECT=postgresql://you@localhost:54329/tracker_dev npx tsx scripts/seed-tracker-demo.ts
 *
 * Safety: refuses to run unless the database host is localhost, so it can
 * never write demo rows into Supabase. Re-running is a no-op once the demo
 * account exists. Dates are relative to today so the demo always shows overdue
 * and upcoming work.
 */
import "dotenv/config";
import { PrismaClient, type TrackerItem } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  // handled below
}
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`Refusing to seed demo data: database host "${host || "unknown"}" is not localhost.`);
  process.exit(1);
}

const DAY = 86_400_000;
const day = (offset: number) => new Date(Math.floor(Date.now() / DAY) * DAY + offset * DAY);

async function main() {
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const existing = await prisma.trackerAccount.findUnique({ where: { slug: "demo-northwind-traders" } });
    if (existing) {
      console.log("Demo account already exists. Nothing to do.");
      return;
    }

    const account = await prisma.trackerAccount.create({
      data: { name: "Northwind Traders (demo data)", slug: "demo-northwind-traders", notes: "Fake demo account. Safe to delete." },
    });
    const staff = await prisma.trackerPerson.create({ data: { side: "talkpush", name: "Demo Solutions Engineer", email: "se@example.test" } });
    const ana = await prisma.trackerPerson.create({
      data: { accountId: account.id, side: "client", name: "Ana Reyes (demo)", title: "HR Operations Lead", email: "ana@example.test" },
    });
    const ben = await prisma.trackerPerson.create({
      data: { accountId: account.id, side: "client", name: "Ben Santos (demo)", title: "IT Manager", email: "ben@example.test" },
    });
    const vendor = await prisma.trackerPerson.create({
      data: { accountId: account.id, side: "vendor", name: "Cleo Vendor (demo)", organisation: "Example HRIS Co", email: "cleo@example.test" },
    });

    const phaseNames = ["Scoping", "Configuration", "UAT", "Training", "Go-live", "Hypercare"];
    const project = await prisma.trackerProject.create({
      data: {
        accountId: account.id,
        title: "Demo: Talkpush rollout",
        objective: "Go live with high-volume hiring in two markets and cut time-to-hire.",
        status: "active",
        startDate: day(-45),
        targetDate: day(40),
        originalTargetDate: day(30),
        rescheduleCount: 1,
        goLiveDate: day(35),
        ownerPersonId: staff.id,
        sponsorPersonId: ana.id,
        phases: {
          create: phaseNames.map((name, i) => ({
            name,
            sortOrder: i,
            startDate: day(-45 + i * 12),
            endDate: day(-34 + i * 12),
          })),
        },
      },
      include: { phases: true },
    });
    const phase = (name: string) => project.phases.find((p) => p.name === name)!.id;

    type Seed = {
      title: string;
      status: string;
      phase: string;
      owner: string;
      due: number | null;
      type?: string;
      milestone?: boolean;
      internal?: boolean;
      blockerReason?: string;
      waitingOn?: string;
    };
    const owners: Record<string, string> = { se: staff.id, ana: ana.id, ben: ben.id, vendor: vendor.id };
    const seeds: Seed[] = [
      { title: "Confirm scope and success metrics", status: "done", phase: "Scoping", owner: "se", due: -40, type: "decision" },
      { title: "Sign off scoping document", status: "done", phase: "Scoping", owner: "ana", due: -35, milestone: true },
      { title: "Create campaigns and folders", status: "done", phase: "Configuration", owner: "se", due: -20, type: "config" },
      { title: "Set up pre-screening questions", status: "in_progress", phase: "Configuration", owner: "se", due: -2, type: "config" },
      { title: "Provide message template approvals", status: "waiting_on_client", phase: "Configuration", owner: "ana", due: 3, waitingOn: "Legal review of SMS wording" },
      { title: "Whitelist sender domain", status: "blocked", phase: "Configuration", owner: "ben", due: 6, type: "integration", blockerReason: "IT change window is not until next month" },
      { title: "Build HRIS candidate sync", status: "not_started", phase: "Configuration", owner: "vendor", due: 14, type: "integration" },
      { title: "Integration complete", status: "not_started", phase: "Configuration", owner: "se", due: 18, milestone: true },
      { title: "Run UAT scripts with recruiters", status: "not_started", phase: "UAT", owner: "ana", due: 24, type: "uat" },
      { title: "UAT sign-off", status: "not_started", phase: "UAT", owner: "ana", due: 28, milestone: true },
      { title: "Train recruiter team", status: "not_started", phase: "Training", owner: "se", due: 32, type: "training" },
      { title: "Go-live", status: "not_started", phase: "Go-live", owner: "se", due: 35, milestone: true },
      { title: "Risk: client approvals slower than planned", status: "in_progress", phase: "Configuration", owner: "se", due: null, type: "risk", internal: true },
      { title: "Hypercare check-ins", status: "not_started", phase: "Hypercare", owner: "se", due: 50, type: "training" },
    ];
    const created: TrackerItem[] = [];
    for (const [i, s] of seeds.entries()) {
      created.push(
        await prisma.trackerItem.create({
          data: {
            projectId: project.id,
            phaseId: phase(s.phase),
            title: s.title,
            type: s.type ?? "config",
            status: s.status,
            visibility: s.internal ? "internal" : "client_visible",
            isMilestone: !!s.milestone,
            ownerPersonId: owners[s.owner],
            dueDate: s.due === null ? null : day(s.due),
            completedAt: s.status === "done" ? day((s.due ?? 0)) : null,
            blockerReason: s.blockerReason ?? null,
            waitingOn: s.waitingOn ?? null,
            sortOrder: i,
            createdVia: "web",
          },
        })
      );
    }
    const byTitle = (t: string) => created.find((c) => c.title === t)!.id;
    const deps: Array<[string, string]> = [
      ["Build HRIS candidate sync", "Whitelist sender domain"],
      ["Integration complete", "Build HRIS candidate sync"],
      ["Run UAT scripts with recruiters", "Integration complete"],
      ["UAT sign-off", "Run UAT scripts with recruiters"],
      ["Go-live", "UAT sign-off"],
    ];
    for (const [item, blockedBy] of deps) {
      await prisma.trackerItemDependency.create({ data: { itemId: byTitle(item), blockedByItemId: byTitle(blockedBy) } });
    }
    await prisma.trackerRemark.createMany({
      data: [
        { itemId: byTitle("Whitelist sender domain"), body: "Ben says the next change window is in 5 weeks. Asking for an exception.", visibility: "internal", authorLabel: "Demo Solutions Engineer" },
        { itemId: byTitle("Provide message template approvals"), body: "Draft wording sent to Ana on Monday.", visibility: "shared", authorLabel: "Demo Solutions Engineer" },
      ],
    });
    await prisma.trackerActivity.create({
      data: { projectId: project.id, entityType: "project", entityId: project.id, action: "project.created", after: { title: project.title }, actorLabel: "seed script", via: "web" },
    });
    console.log(`Seeded demo project "${project.title}" with ${created.length} items.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
