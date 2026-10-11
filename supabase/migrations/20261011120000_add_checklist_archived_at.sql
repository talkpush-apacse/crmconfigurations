-- Migration: 20261011120000_add_checklist_archived_at.sql
--
-- Archive for CRM Config Checklists.
--   * ADDS 1 optional column: "Checklist"."archivedAt" (empty for every existing checklist = still active).
--   * Changes NO existing column or row. Drops nothing. Backfills nothing: a checklist is only archived when staff press Archive.
--   * Archiving only hides a checklist from lists and stops its reminder emails. It deletes nothing, and the client,
--     editor and view links keep working. "Restore" empties the column again.
-- Adding a nullable column in Postgres is instant. Safe to run more than once, and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves),
-- and BEFORE the code that reads the column is merged and deployed (the checklist list selects it).
--
-- Rollback (loses only the "archived" marks; checklists are untouched). Run only if needed:
--   BEGIN;
--   ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "archivedAt";
--   COMMIT;

BEGIN;

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

COMMIT;
