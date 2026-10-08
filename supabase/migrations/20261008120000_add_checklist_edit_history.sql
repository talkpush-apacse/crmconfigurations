-- Migration: 20261008120000_add_checklist_edit_history.sql
--
-- Named edit links and edit history for CRM Config Checklists.
--   * 2 NEW tables: "ChecklistEditLink" (one named link per person per checklist) and
--     "ChecklistEditEvent" (one row per recorded change: who, when, which tab/row/column, before and after).
--   * Changes NO existing table, column or row. Drops nothing. Backfills nothing: history starts when this ships.
--   * The original Checklist."editorToken" link keeps working exactly as before.
-- Safe to run more than once, and it runs as one transaction: if anything fails, nothing is applied.
--
-- Generated with `prisma migrate diff`, then made re-runnable and given row-level security.
-- NOT APPLIED to any shared or production database. Apply to a local scratch database to test.
-- To run for real: paste the whole file into the Supabase SQL editor and click Run (only after Jolo approves).
-- Before and after the real run, use the count queries in docs/checklist-edit-history-release.md.
--
-- Rollback (destroys only the new link and history data; checklists are untouched). Run only if needed:
--   BEGIN;
--   DROP TABLE IF EXISTS "ChecklistEditEvent" CASCADE;
--   DROP TABLE IF EXISTS "ChecklistEditLink" CASCADE;
--   COMMIT;

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistEditLink" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstOpenedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistEditLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistEditEvent" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "linkId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "tabKey" TEXT NOT NULL,
    "tabLabel" TEXT NOT NULL,
    "rowId" TEXT,
    "rowLabel" TEXT,
    "fieldKey" TEXT,
    "fieldLabel" TEXT,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "checklistVersion" INTEGER NOT NULL,
    "coalesceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistEditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistEditLink_token_key" ON "ChecklistEditLink"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChecklistEditLink_checklistId_createdAt_idx" ON "ChecklistEditLink"("checklistId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChecklistEditEvent_checklistId_createdAt_id_idx" ON "ChecklistEditEvent"("checklistId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChecklistEditEvent_checklistId_linkId_createdAt_idx" ON "ChecklistEditEvent"("checklistId", "linkId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistEditEvent_checklistId_coalesceKey_key" ON "ChecklistEditEvent"("checklistId", "coalesceKey");

-- AddForeignKey (guarded so the file can run twice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ChecklistEditLink_checklistId_fkey' AND conrelid = 'public."ChecklistEditLink"'::regclass
  ) THEN
    ALTER TABLE "ChecklistEditLink" ADD CONSTRAINT "ChecklistEditLink_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ChecklistEditEvent_checklistId_fkey' AND conrelid = 'public."ChecklistEditEvent"'::regclass
  ) THEN
    ALTER TABLE "ChecklistEditEvent" ADD CONSTRAINT "ChecklistEditEvent_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ChecklistEditEvent_linkId_fkey' AND conrelid = 'public."ChecklistEditEvent"'::regclass
  ) THEN
    ALTER TABLE "ChecklistEditEvent" ADD CONSTRAINT "ChecklistEditEvent_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ChecklistEditLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Row-level security (same pattern as the other modules: app queries use a direct superuser connection and
-- bypass it; this blocks the Supabase public data API, which matters most for the table that holds link text).
ALTER TABLE "ChecklistEditLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistEditEvent" ENABLE ROW LEVEL SECURITY;

COMMIT;
