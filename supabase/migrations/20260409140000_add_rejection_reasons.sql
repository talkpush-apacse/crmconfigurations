-- Migration: 20260409140000_add_rejection_reasons.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "rejectionReasons";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "rejectionReasons" JSONB;
