/**
 * One-time, idempotent backfill for two behavior changes that would otherwise
 * silently affect existing checklists:
 *
 * 1. "Welcome" tab becomes a normal togglable tab (previously always forced
 *    on). Any checklist that stores an explicit `enabledTabs` list — and
 *    doesn't already mention "welcome" — gets "welcome" added to that list,
 *    so nothing about its navigation changes today. (A checklist with
 *    `enabledTabs: null` already shows every tab and needs no change.)
 * 2. Prescreening question type rename: any stored `questionType` of
 *    "Multiple Choice" becomes "Multiple Choice (Single Select)" so existing
 *    answers keep matching a real dropdown option instead of going blank.
 *
 * Safety:
 * - Defaults to a dry run. Pass --apply to actually write.
 * - Before writing to a checklist, takes a labeled snapshot of its current
 *   state (visible in the app's own Snapshots UI, restorable from there).
 * - Uses the same per-field version-bump convention as the app's own PUT
 *   /api/checklists/[id] route, so optimistic-concurrency checks elsewhere
 *   keep working.
 *
 *   npx tsx scripts/backfill-checklists.ts            # dry run (default)
 *   npx tsx scripts/backfill-checklists.ts --apply     # actually writes
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  CHECKLIST_JSON_FIELDS,
  SNAPSHOT_SCHEMA_VERSION,
  type QuestionRow,
} from "../src/lib/types";

const ROOT = path.join(process.cwd());
for (const envFile of [".env.local", ".env"]) {
  const p = path.join(ROOT, envFile);
  if (fs.existsSync(p)) loadEnv({ path: p });
}

const APPLY = process.argv.includes("--apply");
const OLD_QUESTION_TYPE = "Multiple Choice";
const NEW_QUESTION_TYPE = "Multiple Choice (Single Select)";

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

  let welcomeBackfillCount = 0;
  let questionTypeBackfillCount = 0;

  for (const checklist of checklists) {
    const enabledTabs = checklist.enabledTabs as string[] | null;
    const needsWelcome = Array.isArray(enabledTabs) && !enabledTabs.includes("welcome");
    const newEnabledTabs = needsWelcome ? [...(enabledTabs as string[]), "welcome"] : null;

    const prescreening = (checklist.prescreening as QuestionRow[] | null) ?? [];
    const affectedQuestions = Array.isArray(prescreening)
      ? prescreening.filter((q) => q?.questionType === OLD_QUESTION_TYPE)
      : [];
    const needsQuestionTypeFix = affectedQuestions.length > 0;
    const newPrescreening = needsQuestionTypeFix
      ? prescreening.map((q) =>
          q?.questionType === OLD_QUESTION_TYPE ? { ...q, questionType: NEW_QUESTION_TYPE } : q
        )
      : null;

    if (!needsWelcome && !needsQuestionTypeFix) continue;

    console.log(`- ${checklist.clientName} (${checklist.slug}, id=${checklist.id})`);
    if (needsWelcome) {
      welcomeBackfillCount++;
      console.log(`    enabledTabs: add "welcome" (currently ${JSON.stringify(enabledTabs)})`);
    }
    if (needsQuestionTypeFix) {
      questionTypeBackfillCount++;
      console.log(
        `    prescreening: ${affectedQuestions.length} question(s) "${OLD_QUESTION_TYPE}" -> "${NEW_QUESTION_TYPE}"`
      );
    }

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Checklist" WHERE id = ${checklist.id} FOR UPDATE
      `;
      if (locked.length === 0) return;

      const fresh = await tx.checklist.findUnique({ where: { id: checklist.id } });
      if (!fresh) return;

      // Take a labeled, restorable snapshot before writing.
      const payload = buildSnapshotPayload(fresh as unknown as Record<string, unknown>);
      await tx.checklistSnapshot.create({
        data: {
          checklistId: fresh.id,
          label: `Auto: pre-backfill @ ${new Date().toISOString()}`,
          description:
            "Automatic snapshot before the welcome-tab / question-type backfill script ran.",
          isLabeled: true,
          payload: toPrismaJson(payload),
          versionAtSnapshot: fresh.version,
          createdBy: "admin",
          createdByLabel: "backfill-checklists.ts",
        },
      });

      const newVersion = fresh.version + 1;
      const fieldVersions = { ...((fresh.fieldVersions as Record<string, number> | null) ?? {}) };
      const updateData: Record<string, unknown> = { version: newVersion };

      if (needsWelcome) {
        // Recompute against the freshly-locked row in case it changed since the scan.
        const freshEnabledTabs = fresh.enabledTabs as string[] | null;
        if (Array.isArray(freshEnabledTabs) && !freshEnabledTabs.includes("welcome")) {
          updateData.enabledTabs = toPrismaJson([...freshEnabledTabs, "welcome"]);
          fieldVersions.enabledTabs = newVersion;
        }
      }
      if (needsQuestionTypeFix) {
        const freshPrescreening = (fresh.prescreening as QuestionRow[] | null) ?? [];
        if (Array.isArray(freshPrescreening)) {
          updateData.prescreening = toPrismaJson(
            freshPrescreening.map((q) =>
              q?.questionType === OLD_QUESTION_TYPE ? { ...q, questionType: NEW_QUESTION_TYPE } : q
            )
          );
          fieldVersions.prescreening = newVersion;
        }
      }
      updateData.fieldVersions = toPrismaJson(fieldVersions);

      await tx.checklist.update({ where: { id: fresh.id }, data: updateData });
    });
  }

  console.log(
    `\n${APPLY ? "Applied" : "Would apply"}: ${welcomeBackfillCount} welcome-tab fix(es), ${questionTypeBackfillCount} question-type fix(es).`
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
