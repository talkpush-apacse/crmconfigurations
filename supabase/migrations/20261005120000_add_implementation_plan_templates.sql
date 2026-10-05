-- Migration: 20261005120000_add_implementation_plan_templates.sql
--
-- What it does:
--   * 2 NEW tables: "TrackerPlanTemplate", "TrackerPlanTemplateItem" (the standard plan catalogue). Both start EMPTY.
--   * 1 NEW nullable column on the existing "TrackerItem": "templateItemKey" (+ one index).
--     Existing rows get NULL. Nothing is rewritten, no data changes, no existing behaviour changes. Adding a
--     nullable column in Postgres is instant.
--   * Row-level security on the 2 new tables (same pattern as the tracker release).
-- It drops nothing and deletes nothing. Safe to run more than once. Runs as one transaction.
--
-- Generated with `prisma migrate diff` between the current prisma/schema.prisma and the proposed one,
-- then made re-runnable and given row-level security.
--
-- Rollback (deletes only the plan catalogue; projects and items are untouched except the new empty column).
-- Run only if needed:
--   BEGIN;
--   DROP INDEX IF EXISTS "TrackerItem_projectId_templateItemKey_idx";
--   ALTER TABLE "TrackerItem" DROP COLUMN IF EXISTS "templateItemKey";
--   DROP TABLE IF EXISTS "TrackerPlanTemplateItem" CASCADE;
--   DROP TABLE IF EXISTS "TrackerPlanTemplate" CASCADE;
--   COMMIT;

BEGIN;

-- AlterTable
ALTER TABLE "TrackerItem" ADD COLUMN IF NOT EXISTS "templateItemKey" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerPlanTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "phaseWeeks" JSONB NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TrackerPlanTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "phaseName" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'config',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "audience" TEXT NOT NULL DEFAULT 'shared',
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "defaultIncluded" BOOLEAN NOT NULL DEFAULT true,
    "startDay" INTEGER,
    "endDay" INTEGER,
    "dependsOnKeys" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackerPlanTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerPlanTemplateItem_templateId_sortOrder_idx" ON "TrackerPlanTemplateItem"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TrackerPlanTemplateItem_templateId_key_key" ON "TrackerPlanTemplateItem"("templateId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrackerItem_projectId_templateItemKey_idx" ON "TrackerItem"("projectId", "templateItemKey");

-- AddForeignKey (guarded so the file can be run twice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'TrackerPlanTemplateItem_templateId_fkey' AND conrelid = 'public."TrackerPlanTemplateItem"'::regclass
  ) THEN
    ALTER TABLE "TrackerPlanTemplateItem" ADD CONSTRAINT "TrackerPlanTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrackerPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security.
-- All app queries go through Prisma (direct Postgres connection, superuser role), which bypasses RLS.
-- Turning it on with no policies blocks unauthenticated access through Supabase's public data API.
ALTER TABLE "TrackerPlanTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackerPlanTemplateItem" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Check after running (read-only, run separately):
--   SELECT count(*) AS template_tables FROM information_schema.tables
--     WHERE table_schema = 'public' AND table_name IN ('TrackerPlanTemplate', 'TrackerPlanTemplateItem');   -- expect 2
--   SELECT count(*) AS template_items FROM "TrackerPlanTemplateItem";                                        -- expect 0
--   SELECT count(*) AS items_with_key FROM "TrackerItem" WHERE "templateItemKey" IS NOT NULL;                -- expect 0
--   SELECT count(*) AS item_rows FROM "TrackerItem";                                                         -- same number as before
