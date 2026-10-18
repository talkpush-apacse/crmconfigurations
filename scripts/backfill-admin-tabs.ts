/**
 * One-time, idempotent backfill: "Admin Settings", "Autoflows" and
 * "Integrations" become normal togglable tabs (previously always shown to
 * admins). Any checklist that stores an explicit `enabledTabs` list gets
 * whichever of those three slugs it is missing, so nothing about its
 * navigation changes today. (`enabledTabs: null` already shows every tab and
 * needs no change.)
 *
 * Run this BEFORE (or together with) deploying the toggle change, otherwise
 * checklists with an explicit list lose the three tabs until it runs.
 *
 * Safety: same conventions as backfill-labels-tab.ts. Dry run by default,
 * labeled restorable snapshot before each write, per-field version bump.
 *
 *   npx tsx scripts/backfill-admin-tabs.ts            # dry run (default)
 *   npx tsx scripts/backfill-admin-tabs.ts --apply    # actually writes
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CHECKLIST_JSON_FIELDS, SNAPSHOT_SCHEMA_VERSION } from "../src/lib/types";

const ROOT = path.join(process.cwd());
for (const envFile of [".env.local", ".env"]) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) loadEnv({ path: p });
}

const ADMIN_TAB_SLUGS = ["admin-settings", "autoflows", "integrations"];

const APPLY = process.argv.includes("--apply");

function toPrismaJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function buildSnapshotPayload(checklist: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    isCustom: !!checklist.isCustom,
    configuratorChecklist: checklist.configuratorChecklist ?? null,
  };
  for (const field of CHECKLIST_JSON_FIELDS) {
    payload[field] = checklist[field] ?? null;
  }
  return payload;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_DIRECT or DATABASE_URL is required (checked .env.local, .env, and the shell environment)."
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log(`Mode: ${APPLY ? "APPLY (writing to the database)" : "DRY RUN (--apply to write)"}`);

  const checklists = await prisma.checklist.findMany();
  console.log(`Scanned ${checklists.length} checklist(s).\n`);

  let count = 0;

  for (const checklist of checklists) {
    // Custom checklists render only their own tabs; the standard list is unused.
    if (checklist.isCustom) continue;
    const enabledTabs = checklist.enabledTabs as string[] | null;
    const missing = Array.isArray(enabledTabs)
      ? ADMIN_TAB_SLUGS.filter((slug) => !enabledTabs.includes(slug))
      : [];
    if (missing.length === 0) continue;

    count++;
    console.log(`- ${checklist.clientName} (${checklist.slug}, id=${checklist.id})`);
    console.log(`    enabledTabs: add ${JSON.stringify(missing)} (currently ${JSON.stringify(enabledTabs)})`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Checklist" WHERE id = ${checklist.id} FOR UPDATE
      `;
      if (locked.length === 0) return;

      const fresh = await tx.checklist.findUnique({ where: { id: checklist.id } });
      if (!fresh) return;

      const freshEnabledTabs = fresh.enabledTabs as string[] | null;
      if (fresh.isCustom || !Array.isArray(freshEnabledTabs)) return;
      const freshMissing = ADMIN_TAB_SLUGS.filter((slug) => !freshEnabledTabs.includes(slug));
      if (freshMissing.length === 0) return;

      await tx.checklistSnapshot.create({
        data: {
          checklistId: fresh.id,
          label: `Auto: pre-admin-tabs-backfill @ ${new Date().toISOString()}`,
          description: "Automatic snapshot before the admin-tabs backfill script ran.",
          isLabeled: true,
          payload: toPrismaJson(buildSnapshotPayload(fresh as unknown as Record<string, unknown>)),
          versionAtSnapshot: fresh.version,
          createdBy: "admin",
          createdByLabel: "backfill-admin-tabs.ts",
        },
      });

      const newVersion = fresh.version + 1;
      const fieldVersions = { ...((fresh.fieldVersions as Record<string, number> | null) ?? {}) };
      fieldVersions.enabledTabs = newVersion;

      await tx.checklist.update({
        where: { id: fresh.id },
        data: {
          version: newVersion,
          enabledTabs: toPrismaJson([...freshEnabledTabs, ...freshMissing]),
          fieldVersions: toPrismaJson(fieldVersions),
        },
      });
    });
  }

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${count} admin-tabs fix(es).`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
