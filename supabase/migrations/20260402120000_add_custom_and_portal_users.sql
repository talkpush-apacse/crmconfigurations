-- Migration: 20260402120000_add_custom_and_portal_users.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "agencyPortalUsers", DROP COLUMN IF EXISTS "isCustom", DROP COLUMN IF EXISTS "customSchema", DROP COLUMN IF EXISTS "customData";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "agencyPortalUsers" JSONB;
ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "customSchema" JSONB;
ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "customData" JSONB;
