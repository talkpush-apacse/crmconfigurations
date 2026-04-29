-- Migration: 20260429120000_add_owner_notifications
-- Rollback:
--   ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "ownerEmail";
--   ALTER TABLE "Checklist" DROP COLUMN IF EXISTS "notificationState";

ALTER TABLE "Checklist"
  ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationState" JSONB;
