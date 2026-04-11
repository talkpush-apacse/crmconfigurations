-- Migration: 20260410120000_add_tab_upload_meta.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "tabUploadMeta";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "tabUploadMeta" JSONB;
