-- Migration: 20260418000000_add_instance_config.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "instanceConfig";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "instanceConfig" JSONB;
