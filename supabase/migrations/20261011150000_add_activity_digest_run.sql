-- Migration: 20261011150000_add_activity_digest_run.sql
--
-- A send record for the daily activity digest (the weekday 8:00 am Manila email to the super admin).
--   * 1 NEW table: "ActivityDigestRun" (one row per digest slot: when its window started and ended, whether the email
--     was sent, skipped because nothing changed, or failed, and how many changes it listed).
--   * Changes NO existing table, column or row. Drops nothing. Backfills nothing: the first row appears at the next digest.
--   * Holds NO personal data and NO change content: no email addresses, no names, no text from any checklist,
--     workflow or tracker. Only times, a status word, a count and a short plain reason.
-- What it is for: Vercel runs scheduled jobs on a best-effort basis, so a run can be missed or happen twice.
--   * The unique "windowEnd" means two runs for the same 8:00 am slot cannot both send (the second finds the row).
--   * The next digest starts where the last sent or skipped one ended (up to 7 days back), so a missed day is
--     caught up in the next email instead of lost.
-- Safe to run more than once, and it runs as one transaction: if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves).
-- Before and after the real run, use the queries in docs/activity-digest-release.md.
--
-- Rollback (destroys only the send records; checklists, workflows and trackers are untouched). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "ActivityDigestRun";
--   COMMIT;
-- (The digest keeps working without the table: it logs a warning and sends without the duplicate and catch-up protection.)

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityDigestRun" (
    "id" TEXT NOT NULL,
    -- The changes this digest covers: from windowStart (inclusive) up to windowEnd (exclusive).
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    -- sending | sent | skipped | failed. A plain word checked in code, like the other modules.
    "status" TEXT NOT NULL,
    "changeCount" INTEGER NOT NULL DEFAULT 0,
    -- A short plain reason for skipped or failed (for example "no changes"). Never an error dump.
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ActivityDigestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (one row per 8:00 am slot: this is what stops a duplicate run from sending twice)
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityDigestRun_windowEnd_key" ON "ActivityDigestRun"("windowEnd");

-- Row-level security (same pattern as the other modules: app queries use a direct superuser connection and
-- bypass it; this blocks the Supabase public data API).
ALTER TABLE "ActivityDigestRun" ENABLE ROW LEVEL SECURITY;

COMMIT;
