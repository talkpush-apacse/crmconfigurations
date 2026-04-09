-- Migration: 20260409140000_add_attributes.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "attributes";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
