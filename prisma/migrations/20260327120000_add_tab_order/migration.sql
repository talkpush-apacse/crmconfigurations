-- Migration: 20260327120000_add_tab_order.sql
-- Rollback: ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "tabOrder";

ALTER TABLE "Checklist" ADD COLUMN IF NOT EXISTS "tabOrder" JSONB;
