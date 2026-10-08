-- Migration: 20261008150000_add_checklist_view_token.sql
--
-- The read-only "can view" link for CRM Config Checklists.
--   * ADDS 1 optional column: "Checklist"."viewToken" (empty for every existing checklist) and a unique index on it.
--   * Changes NO existing column or row. Drops nothing. Backfills nothing: a view link only exists once staff turn one on.
--   * The original "editorToken" link, named edit links and the client link keep working exactly as before.
-- Safe to run more than once, and it runs as one transaction: if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves),
-- and BEFORE the code that reads the column is merged and deployed.
--
-- Rollback (loses only the view links; checklists are untouched). Run only if needed:
--   BEGIN;
--   DROP INDEX IF EXISTS "Checklist_viewToken_key";
--   ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "viewToken";
--   COMMIT;

BEGIN;

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "viewToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Checklist_viewToken_key" ON "Checklist"("viewToken");

COMMIT;
