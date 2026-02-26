-- Migration: 20260226000000_add_feature_toggles.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "featureToggles";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "featureToggles" JSONB;
