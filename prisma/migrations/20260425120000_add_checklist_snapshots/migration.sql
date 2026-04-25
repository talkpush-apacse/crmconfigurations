-- Migration: 20260425120000_add_checklist_snapshots
-- Rollback: DROP TABLE IF EXISTS "ChecklistSnapshot";

CREATE TABLE IF NOT EXISTS "ChecklistSnapshot" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "label" TEXT,
  "description" TEXT,
  "isLabeled" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "versionAtSnapshot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "createdByLabel" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "ChecklistSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChecklistSnapshot_checklistId_createdAt_idx"
  ON "ChecklistSnapshot"("checklistId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChecklistSnapshot_checklistId_archived_idx"
  ON "ChecklistSnapshot"("checklistId", "archived");

ALTER TABLE "ChecklistSnapshot"
  ADD CONSTRAINT "ChecklistSnapshot_checklistId_fkey"
  FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
