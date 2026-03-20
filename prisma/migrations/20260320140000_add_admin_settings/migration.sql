-- Migration: 20260320140000_add_admin_settings.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "adminSettings";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "adminSettings" JSONB;
