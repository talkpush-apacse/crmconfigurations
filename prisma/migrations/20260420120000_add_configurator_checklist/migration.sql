-- Migration: 20260420120000_add_configurator_checklist.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "configuratorChecklist";

ALTER TABLE "Checklist"
  ADD COLUMN IF NOT EXISTS "configuratorChecklist" JSONB;
