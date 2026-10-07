-- Migration: 20261007120000_add_company_link.sql
--
-- Company gallery, step 2: let checklists and workflows belong to a company.
-- The "company" is the existing "TrackerAccount" (the Project Tracker's Accounts), now shared by all three modules.
--
-- What it does:
--   * ONE new nullable column "accountId" on "Checklist" and ONE on "WorkflowProject", plus an index on each.
--   * A foreign key from each to "TrackerAccount"("id") with ON DELETE SET NULL (accounts are archived, never deleted;
--     if one ever were, its checklists and workflows simply become "not linked yet" instead of being lost).
--   Every existing row gets NULL, which the app shows as "needs a company". NOTHING is guessed or backfilled: no row
--   is matched to a company by name. Adding a nullable column in Postgres is instant and rewrites no rows.
-- It drops nothing, deletes nothing, adds no table, and touches no other column. Safe to run more than once.
-- Runs as one transaction: if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. It must be applied BEFORE the pull request that reads these
-- columns is merged and deployed (the app selects them). To run for real: paste the whole file into the Supabase SQL
-- editor and click Run (only after Jolo approves).
--
-- Check BEFORE (both should return 0):
--   SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
--     AND table_name IN ('Checklist', 'WorkflowProject') AND column_name = 'accountId';        -- 0
-- Check AFTER:
--   SELECT table_name FROM information_schema.columns WHERE table_schema = 'public'
--     AND table_name IN ('Checklist', 'WorkflowProject') AND column_name = 'accountId';        -- both tables
--   SELECT count(*) AS linked FROM "Checklist" WHERE "accountId" IS NOT NULL;                  -- 0 (nothing is linked yet)
--   SELECT count(*) AS checklist_rows FROM "Checklist";                                         -- same number as before
--   SELECT count(*) AS workflow_rows FROM "WorkflowProject";                                    -- same number as before
--
-- Rollback (removes only the two new, empty columns and their index/constraint; no other data is touched):
--   BEGIN;
--   ALTER TABLE "Checklist"       DROP COLUMN IF EXISTS "accountId";
--   ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "accountId";
--   COMMIT;
-- (dropping a column also drops its index and foreign key)

BEGIN;

-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Checklist_accountId_idx" ON "Checklist"("accountId");
CREATE INDEX IF NOT EXISTS "WorkflowProject_accountId_idx" ON "WorkflowProject"("accountId");

-- AddForeignKey (guarded so the file can be run twice)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Checklist_accountId_fkey') THEN
    ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "TrackerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowProject_accountId_fkey') THEN
    ALTER TABLE "WorkflowProject" ADD CONSTRAINT "WorkflowProject_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "TrackerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
