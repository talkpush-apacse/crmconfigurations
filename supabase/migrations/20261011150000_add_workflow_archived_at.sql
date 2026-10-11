-- Migration: 20261011150000_add_workflow_archived_at.sql
--
-- Archive for Workflows (Process Maps).
--   * ADDS 1 optional column: "WorkflowProject"."archivedAt" (empty for every existing workflow = still active).
--   * Changes NO existing column or row. Drops nothing. Backfills nothing: a workflow is only archived when staff press Archive.
--   * Archiving only hides a workflow from lists. It deletes nothing, and share and review links keep working.
--     "Restore" empties the column again.
-- Adding a nullable column in Postgres is instant. Safe to run more than once, and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves),
-- and BEFORE the code that reads the column is merged and deployed (the workflow list selects it).
--
-- Rollback (loses only the "archived" marks; workflows are untouched). Run only if needed:
--   BEGIN;
--   ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "archivedAt";
--   COMMIT;

BEGIN;

ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

COMMIT;
