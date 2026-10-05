/**
 * One-time, idempotent backfill: "Labels" becomes a normal togglable tab
 * (previously always forced on). Any checklist that stores an explicit
 * `enabledTabs` list and doesn't already mention "labels" gets "labels" added,
 * so nothing about its navigation changes today. (`enabledTabs: null` already
 * shows every tab and needs no change.)
 *
 * Safety: same conventions as backfill-checklists.ts. Dry run by default,
 * labeled restorable snapshot before each write, per-field version bump.
 *
 *   npx tsx scripts/backfill-labels-tab.ts            # dry run (default)
 *   npx tsx scripts/backfill-labels-tab.ts --apply    # actually writes
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
    const enabledTabs = checklist.enabledTabs as string[] | null;
    const needsLabels = Array.isArray(enabledTabs) && !enabledTabs.includes("labels");
    if (!needsLabels) continue;

    count++;
    console.log(`- ${checklist.clientName} (${checklist.slug}, id=${checklist.id})`);
    console.log(`    enabledTabs: add "labels" (currently ${JSON.stringify(enabledTabs)})`);

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Checklist" WHERE id = ${checklist.id} FOR UPDATE
      `;
      if (locked.length === 0) return;

      const fresh = await tx.checklist.findUnique({ where: { id: checklist.id } });
      if (!fresh) return;

      const freshEnabledTabs = fresh.enabledTabs as string[] | null;
      if (!Array.isArray(freshEnabledTabs) || freshEnabledTabs.includes("labels")) return;

      await tx.checklistSnapshot.create({
        data: {
          checklistId: fresh.id,
          label: `Auto: pre-labels-backfill @ ${new Date().toISOString()}`,
          description: "Automatic snapshot before the Labels-tab backfill script ran.",
          isLabeled: true,
          payload: toPrismaJson(buildSnapshotPayload(fresh as unknown as Record<string, unknown>)),
          versionAtSnapshot: fresh.version,
          createdBy: "admin",
          createdByLabel: "backfill-labels-tab.ts",
        },
      });

      const newVersion = fresh.version + 1;
      const fieldVersions = { ...((fresh.fieldVersions as Record<string, number> | null) ?? {}) };
      fieldVersions.enabledTabs = newVersion;

      await tx.checklist.update({
        where: { id: fresh.id },
        data: {
          version: newVersion,
          enabledTabs: toPrismaJson([...freshEnabledTabs, "labels"]),
          fieldVersions: toPrismaJson(fieldVersions),
        },
      });
    });
  }

  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${count} labels-tab fix(es).`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
