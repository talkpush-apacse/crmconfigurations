-- Migration: 20260418120000_add_ats_integrations.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "atsIntegrations";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "atsIntegrations" JSONB;
