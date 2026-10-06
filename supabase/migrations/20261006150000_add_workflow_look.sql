-- Migration: 20261006150000_add_workflow_look.sql
--
-- Workflow Builder readability pass. Adds ONE column to "WorkflowProject":
--   look  'original' | 'readable'   (default 'original')
-- 'original' is how every map looked before the readability pass (small text, original colours, DM Sans). Because the
-- default is 'original', every EXISTING map keeps looking exactly as it does today. New maps are created with
-- 'readable' by the app (bigger text, calmer colour, accent main path, Inter). A map can be switched either way in the editor.
-- Changes no other table. Drops and backfills nothing. Safe to run more than once; runs as one transaction.
--
-- NOT APPLIED to any shared or production database. It must be applied BEFORE the pull request that reads the column is
-- merged and deployed (the app selects the column). To run for real: paste into the Supabase SQL editor and click Run
-- (only after Jolo approves).
--
-- Rollback (only deletes the setting; diagrams are untouched):
--   BEGIN;
--   ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "look";
--   COMMIT;

BEGIN;

ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "look" TEXT NOT NULL DEFAULT 'original';

COMMIT;
