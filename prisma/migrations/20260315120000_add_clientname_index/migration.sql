-- Migration: 20260315120000_add_clientname_index
-- Rollback: DROP INDEX IF EXISTS "Checklist_clientName_idx";

CREATE INDEX IF NOT EXISTS "Checklist_clientName_idx" ON "Checklist"("clientName");
