-- Migration: 20260411120000_add_tab_filled_by.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "tabFilledBy";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "tabFilledBy" JSONB;
