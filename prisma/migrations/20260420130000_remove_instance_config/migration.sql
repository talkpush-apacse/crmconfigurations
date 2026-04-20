-- Migration: 20260420130000_remove_instance_config
-- Rollback: ALTER TABLE "Checklist" ADD COLUMN "instanceConfig" JSONB;

ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "instanceConfig";
