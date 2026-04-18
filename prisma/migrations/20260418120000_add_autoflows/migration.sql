-- Migration: 20260418120000_add_autoflows.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "autoflows";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "autoflows" JSONB;
