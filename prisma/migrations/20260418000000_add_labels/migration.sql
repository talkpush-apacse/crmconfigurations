-- Migration: 20260418000000_add_labels.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "labels";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "labels" JSONB;
