-- Migration: 20261016120000_add_workflow_link_name.sql
--
-- Several live shared links per level in the Workflow Builder, each with an optional name.
--   * ADDS 1 optional column: "WorkflowLink"."name" (empty for every existing link = unnamed, works exactly as before).
--   * Changes NO existing column or row. Drops nothing. Backfills nothing. Every link already issued keeps working.
--   * The name is only a label for staff ("Roxanne - B2B"), shown in the Share box. Clients never see it.
-- Adding a nullable column in Postgres is instant. Safe to run more than once, and it runs as one transaction:
-- if anything fails, nothing is applied.
--
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves),
-- and BEFORE the code that reads the column is merged and deployed (the Share box and every shared-link visit select it).
--
-- Rollback (loses only the link names; links are untouched). Run only if needed:
--   BEGIN;
--   ALTER TABLE "WorkflowLink" DROP COLUMN IF EXISTS "name";
--   COMMIT;

BEGIN;

ALTER TABLE "WorkflowLink" ADD COLUMN IF NOT EXISTS "name" TEXT;

COMMIT;
