-- Migration: 20260409120000_add_custom_tabs.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "customTabs";

-- Add customTabs column for custom tabs on standard checklists
ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "customTabs" JSONB;
