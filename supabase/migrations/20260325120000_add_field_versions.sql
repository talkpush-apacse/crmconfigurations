-- Migration: 20260325120000_add_field_versions.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "fieldVersions";
-- Purpose: Add per-field version tracking for field-level merge on concurrent edits

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "fieldVersions" JSONB DEFAULT '{}';

-- Backfill: set all existing JSON field versions to the current global version
UPDATE "Checklist" SET "fieldVersions" = jsonb_build_object(
  'enabledTabs', version,
  'communicationChannels', version,
  'featureToggles', version,
  'companyInfo', version,
  'users', version,
  'campaigns', version,
  'sites', version,
  'prescreening', version,
  'messaging', version,
  'sources', version,
  'folders', version,
  'documents', version,
  'fbWhatsapp', version,
  'instagram', version,
  'aiCallFaqs', version,
  'agencyPortal', version,
  'adminSettings', version
);
