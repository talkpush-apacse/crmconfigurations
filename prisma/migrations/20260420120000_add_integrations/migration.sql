-- Migration: 20260420120000_add_integrations.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "integrations";

ALTER TABLE "Checklist"
  ADD COLUMN IF NOT EXISTS "integrations" JSONB NOT NULL DEFAULT '[]'::jsonb;
