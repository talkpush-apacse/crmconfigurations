-- Migration: 20261004140000_add_workflow_diagram_style.sql
--
-- Workflow Builder phase 3 (Process Map style). Needs 20261004120000_add_workflow_builder.sql first.
-- Adds TWO columns to "WorkflowProject", both with defaults, so every existing workflow keeps looking exactly as it does today:
--   diagramStyle    'classic' | 'process_map'   (default 'classic')
--   numberingScheme 'letters' | 'decimal'       (default 'letters')
-- Changes no other table. Drops and backfills nothing. Safe to run more than once; runs as one transaction.
--
-- NOT APPLIED to any shared or production database. To run for real: paste into the Supabase SQL editor and click Run (only after Jolo approves).
--
-- Rollback (only deletes the two settings; diagrams are untouched):
--   BEGIN;
--   ALTER TABLE "WorkflowProject" DROP COLUMN IF EXISTS "diagramStyle", DROP COLUMN IF EXISTS "numberingScheme";
--   COMMIT;

BEGIN;

ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "diagramStyle" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "WorkflowProject" ADD COLUMN IF NOT EXISTS "numberingScheme" TEXT NOT NULL DEFAULT 'letters';

COMMIT;
