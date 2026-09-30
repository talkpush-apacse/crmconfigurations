/**
 * One-time, idempotent fix: restores the real hyperlink on Inspiro's
 * "Agent Voice" row in the Global Agent Settings custom tab.
 *
 * The source workbook (Inspiro_AI_Voice_Call_Checklist) has exactly one
 * hyperlink in the whole file — cell Global Agent Settings!B18, text
 * "Sample audio here." with "here" linking to a Google Drive file. When that
 * tab was manually transcribed into this app's custom-tab JSON, only the
 * display text was carried over; the link itself was dropped. This script
 * puts it back as a markdown link (`[label](url)`), which EditableCell now
 * renders as a real clickable link (see spreadsheet-infer.ts /
 * EditableCell.tsx for the general hyperlink-support change this pairs with).
 *
 *   npx tsx scripts/fix-inspiro-agent-voice-link.ts            # dry run (default)
 *   npx tsx scripts/fix-inspiro-agent-voice-link.ts --apply    # actually writes
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CHECKLIST_JSON_FIELDS, SNAPSHOT_SCHEMA_VERSION } from "../src/lib/types";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) loadEnv({ path: p });
}

const APPLY = process.argv.includes("--apply");

const CHECKLIST_ID = "cmu2wb6q60000qngcf0zfjvk6"; // Inspiro
const SETTINGS_FIELD_ID = "41de165e-def2-42fc-b54d-cd653790f935"; // "Settings" table field
const AGENT_VOICE_ROW_ID = "d1a2a169-1d9c-47a9-add8-03ef0f2028b9";
const OLD_VALUE = "Sample audio here.";
const NEW_VALUE =
  "Sample audio [here](https://drive.google.com/file/d/1FNXtIYoBZKBt50lvcT3yHdPQV5xYeKVB/view?usp=sharing).";

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
  if (!databaseUrl) throw new Error("DATABASE_URL_DIRECT or DATABASE_URL is required.");

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  console.log(`Mode: ${APPLY ? "APPLY (writing to the database)" : "DRY RUN (--apply to write)"}`);

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Checklist" WHERE id = ${CHECKLIST_ID} FOR UPDATE
    `;
    if (locked.length === 0) throw new Error("Inspiro checklist not found.");

    const fresh = await tx.checklist.findUnique({ where: { id: CHECKLIST_ID } });
    if (!fresh) throw new Error("Inspiro checklist not found.");

    const customData = { ...((fresh.customData as Record<string, unknown> | null) ?? {}) };
    const rows = customData[SETTINGS_FIELD_ID];
    if (!Array.isArray(rows)) {
      throw new Error(`customData["${SETTINGS_FIELD_ID}"] is not an array — aborting.`);
    }

    const rowIdx = rows.findIndex((r) => r?.id === AGENT_VOICE_ROW_ID);
    if (rowIdx === -1) throw new Error("Agent Voice row not found — aborting.");

    const currentValue = rows[rowIdx]?.value;
    if (currentValue !== OLD_VALUE) {
      console.log(
        `Row's "value" is ${JSON.stringify(currentValue)}, not the expected ${JSON.stringify(OLD_VALUE)} — already fixed or changed since. Nothing to do.`
      );
      return;
    }

    console.log(`Agent Voice row "value":\n  before: ${JSON.stringify(currentValue)}\n  after:  ${JSON.stringify(NEW_VALUE)}`);

    if (!APPLY) return;

    const payload = buildSnapshotPayload(fresh as unknown as Record<string, unknown>);
    await tx.checklistSnapshot.create({
      data: {
        checklistId: fresh.id,
        label: `Auto: pre-fix @ ${new Date().toISOString()}`,
        description: 'Automatic snapshot before restoring the "Agent Voice" hyperlink.',
        isLabeled: true,
        payload: toPrismaJson(payload),
        versionAtSnapshot: fresh.version,
        createdBy: "admin",
        createdByLabel: "fix-inspiro-agent-voice-link.ts",
      },
    });

    const newRows = [...rows];
    newRows[rowIdx] = { ...newRows[rowIdx], value: NEW_VALUE };
    const newCustomData = { ...customData, [SETTINGS_FIELD_ID]: newRows };

    const newVersion = fresh.version + 1;
    const fieldVersions = {
      ...((fresh.fieldVersions as Record<string, number> | null) ?? {}),
      customData: newVersion,
    };

    await tx.checklist.update({
      where: { id: fresh.id },
      data: {
        version: newVersion,
        fieldVersions: toPrismaJson(fieldVersions),
        customData: toPrismaJson(newCustomData),
      },
    });

    console.log("Applied.");
  });

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
